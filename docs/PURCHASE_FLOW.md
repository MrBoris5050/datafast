# Purchase Flow: From Button Click to Transaction

This document explains the complete flow of what happens when a user clicks the "Purchase" button.

## 1. Frontend: User Clicks Purchase Button

**Location**: `src/app/dashboard/buy-data/page.tsx`

### Step 1.1: User Interaction
```typescript
// User clicks "Purchase with Wallet" button (line 632-703)
onClick={async () => {
  setIsPurchasing(true)
  const res = await fetch('/api/orders/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      planId: selectedPlanData?.id, 
      phoneNumber 
    }),
  })
  // Handle response...
}}
```

**What happens:**
- User selects a data plan and enters phone number
- Clicks "Purchase with Wallet" button
- Frontend sends POST request to `/api/orders/purchase`
- Request body contains: `{ planId, phoneNumber }`

---

## 2. Backend: Purchase API Route

**Location**: `src/app/api/orders/purchase/route.ts`

### Step 2.1: Request Validation (Lines 12-36)
```typescript
export async function POST(request: NextRequest) {
  // 1. Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse request body
  const { planId, phoneNumber } = await request.json()
  if (!planId || !phoneNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 3. Fetch user and plan data
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.dataPlan.findUnique({ where: { id: planId } }),
  ])

  // 4. Check wallet balance
  const price = getPlanPriceForRole(plan, user.role)
  const balance = Number(user.walletBalance || 0)
  if (balance < price) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
  }
}
```

**What happens:**
- ✅ Validates user is authenticated
- ✅ Validates required fields (planId, phoneNumber)
- ✅ Fetches user and plan from database
- ✅ Calculates price based on user role
- ✅ Checks if user has sufficient wallet balance

---

### Step 2.2: Transaction Starts - Order Creation (Lines 43-130)

**This is where the database transaction begins:**

```typescript
const reference = generateReference() // Generate unique order reference

await prisma.$transaction(async (tx) => {
  // TRANSACTION STARTED HERE ⬆️
  // All database operations below are atomic (all succeed or all fail)
  
  // 1. Generate order number
  const maxOrder = await tx.order.findFirst({
    where: { orderNumber: { not: null } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const orderNumber = maxOrder?.orderNumber ? maxOrder.orderNumber + 1 : 1

  // 2. Deduct wallet balance
  await tx.user.update({
    where: { id: user.id },
    data: { walletBalance: { decrement: price } },
  })

  // 3. Create order record
  const order = await tx.order.create({
    data: {
      orderNumber,
      userId: user.id,
      planId: plan.id,
      amount: price,
      phone: phoneNumber,
      reference,
      status: 'PROCESSING', // Initial status
    },
  })

  // 4. Log order creation (within transaction)
  await logOrderCreated(order.id, reference, {
    orderNumber,
    network: plan.network,
    planName: plan.name,
    amount: Number(price),
    phone: phoneNumber
  }, tx)

  // 5. Log payment processing (within transaction)
  await logPaymentProcessing(order.id, 'wallet', Number(price), {
    reference
  }, tx)

  // 6. Create payment record
  await tx.payment.create({
    data: {
      orderId: order.id,
      userId: user.id,
      amount: price,
      status: 'PENDING',
      method: 'wallet',
      reference,
      gateway: 'wallet',
    },
  })

  // 7. Create data usage record
  await tx.dataUsage.create({
    data: {
      userId: user.id,
      phone: phoneNumber,
      dataUsed: plan.dataAmount,
      planName: plan.name,
      network: plan.network,
    },
  })

  // 8. Create transaction record
  await tx.transaction.create({
    data: {
      userId: user.id,
      type: 'PURCHASE',
      amount: price,
      description: `Wallet purchase: ${plan.name}`,
      reference,
      status: 'PENDING',
    },
  })
  
  // TRANSACTION COMMITS HERE ⬇️
  // If any operation fails, entire transaction rolls back
}, {
  maxWait: 15000,  // Wait up to 15s for transaction slot
  timeout: 30000,  // Transaction must complete within 30s
})
```

**What happens in the transaction:**
1. ✅ **Order number generated** - Sequential number for display
2. ✅ **Wallet deducted** - User's balance reduced immediately
3. ✅ **Order created** - Order record with status 'PROCESSING'
4. ✅ **Logs created** - Order creation and payment logs
5. ✅ **Payment record** - Payment tracking record
6. ✅ **Usage record** - Data usage tracking
7. ✅ **Transaction record** - Financial transaction record

**Transaction Properties:**
- **Atomic**: All operations succeed or all fail
- **Isolated**: Other transactions can't see partial changes
- **Consistent**: Database remains in valid state
- **Durable**: Once committed, changes are permanent

---

### Step 2.3: VTU API Call (Asynchronous) (Lines 152-320)

**After transaction commits, VTU processing starts asynchronously:**

```typescript
// Get order ID for logging
const orderForVtu = await prisma.order.findUnique({
  where: { reference },
  select: { id: true }
})

// Fire VTU call asynchronously (non-blocking)
purchaseViaVtu({ 
  userId: user.id, 
  network: plan.network, 
  planName: plan.name, 
  amount: price, 
  phone: phoneNumber, 
  reference,
  dataAmountMB: plan.dataAmount,
  orderId: orderForVtu?.id
}).then(async (vtu) => {
  // This runs AFTER VTU API responds (could be seconds later)
  
  if (vtu.success) {
    // VTU API call succeeded
    await prisma.$transaction(async (tx) => {
      // NEW TRANSACTION: Update order with provider reference
      await tx.order.update({ 
        where: { reference }, 
        data: { 
          status: 'PROCESSING',
          providerReference: vtu.providerReference,
          isManual: false
        } 
      })
    })
    
    // Log status change (outside transaction)
    await logStatusChange(order.id, 'PENDING', 'PROCESSING', {
      providerReference: vtu.providerReference
    })
  } else {
    // VTU API call failed
    await prisma.$transaction(async (tx) => {
      // NEW TRANSACTION: Mark order for manual processing
      await tx.order.update({ 
        where: { reference }, 
        data: { 
          status: 'PENDING',
          isManual: true,
          providerReference: null
        } 
      })
    })
    
    // Log failure (outside transaction)
    await logVtuApiFailure(...)
    await logManualProcessing(...)
  }
})
```

**What happens:**
1. ✅ **VTU processing starts** - Logs "Starting VTU processing"
2. ✅ **API call made** - Sends request to DataHub API (logs request)
3. ⏳ **Waits for response** - Up to 180 seconds timeout
4. ✅ **On success**: Updates order with provider reference
5. ❌ **On failure**: Marks order as manual processing
6. 📝 **Logs everything** - All API calls, responses, errors

---

### Step 2.4: Immediate Response to User (Line 325)

```typescript
// Return immediately - order is PROCESSING and will be updated asynchronously
return NextResponse.json({ 
  success: true, 
  reference,
  status: 'PROCESSING',
  message: 'Order is being processed. You will be notified when it completes.'
})
```

**What happens:**
- ✅ API returns immediately (doesn't wait for VTU)
- ✅ User sees success message
- ✅ Order continues processing in background

---

## 3. Frontend: Handle Response

**Location**: `src/app/dashboard/buy-data/page.tsx` (Lines 637-703)

```typescript
const res = await fetch('/api/orders/purchase', {...})
const data = await res.json()

if (!res.ok) {
  // Handle error
  setErr(errorMsg)
  toast({ title: "Purchase Failed", ... })
  return
}

// Success!
setIsOrderConfirmModalOpen(false)
setSuccessDetails({
  planName: selectedPlanData.name,
  network: selectedPlanData.network,
  phone: phoneNumber,
  dataSize: formatDataAmount(selectedPlanData.dataAmount)
})
setIsSuccessModalOpen(true)
```

**What happens:**
- ✅ Shows success modal
- ✅ Displays order details
- ✅ User can view orders or close modal

---

## 4. Background: Order Completion

**Order status updates happen asynchronously:**

### Option A: Via Webhook (Most Common)
1. DataHub API processes order
2. DataHub sends webhook to `/api/webhooks/datahubgh`
3. Webhook handler updates order status to 'COMPLETED'
4. SMS sent to user
5. Logs created

### Option B: Manual Processing
1. If VTU API fails, order marked `isManual: true`
2. Admin processes order manually
3. Admin updates status via admin panel
4. Logs created

---

## Transaction Timeline

```
User Clicks Purchase
    ↓
[Transaction 1] (30s timeout)
    ├─ Generate Order Number
    ├─ Deduct Wallet
    ├─ Create Order
    ├─ Create Payment Record
    ├─ Create Usage Record
    ├─ Create Transaction Record
    └─ Create Logs
    ↓
Transaction Commits ✅
    ↓
API Returns to User (immediate)
    ↓
[Async] VTU API Call (up to 180s)
    ├─ Log: "Starting VTU processing"
    ├─ Log: "Sending request to DataHub API"
    ├─ Wait for response...
    └─ Log: "VTU API success/failure"
    ↓
[Transaction 2] (30s timeout)
    ├─ Update Order Status
    └─ Update Provider Reference
    ↓
Transaction Commits ✅
    ↓
Log Status Change (outside transaction)
    ↓
[Later] Webhook Received
    ↓
[Transaction 3] (30s timeout)
    ├─ Update Order to COMPLETED
    ├─ Update Payment Status
    └─ Update Transaction Status
    ↓
Transaction Commits ✅
    ↓
Send SMS to User
```

---

## Key Points

1. **First Transaction**: Creates order and deducts wallet (atomic)
2. **VTU Call**: Happens asynchronously (doesn't block user)
3. **Second Transaction**: Updates order with VTU response
4. **Webhook Transaction**: Final status update when DataHub completes
5. **All Logs**: Created outside transactions to prevent timeouts

---

## Error Handling

- **Insufficient balance**: Transaction never starts, error returned immediately
- **Transaction timeout**: Transaction rolls back, order not created
- **VTU API failure**: Order marked for manual processing
- **VTU API timeout**: Order marked for manual processing after 180s
- **Webhook failure**: Order remains in PROCESSING, can be manually updated

