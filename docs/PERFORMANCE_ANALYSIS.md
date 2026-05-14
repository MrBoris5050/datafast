# Purchase Flow Performance Analysis

## Current Timing Breakdown

### User Experience (What User Waits For)
- **Best Case**: ~1-2 seconds (API returns immediately)
- **Worst Case**: ~30 seconds (if transaction is slow)
- **Typical**: ~2-5 seconds

### Background Processing (User Doesn't Wait)
- **VTU API Call**: 5-180 seconds (typically 10-30 seconds)
- **Webhook Processing**: 1-5 seconds (when DataHub responds)
- **Total Order Completion**: 10-180 seconds after purchase

---

## Current Bottlenecks

### 1. **Duplicate Database Queries** ⚠️
**Location**: `src/app/api/orders/purchase/route.ts` (Lines 136-139, 153-156)

```typescript
// First query (line 136)
const order = await prisma.order.findUnique({
  where: { reference },
  select: { id: true }
})

// Second query (line 153) - DUPLICATE!
const orderForVtu = await prisma.order.findUnique({
  where: { reference },
  select: { id: true }
})
```

**Impact**: ~50-200ms wasted per purchase
**Fix**: Use the order ID from the transaction

### 2. **Order Number Generation** ⚠️
**Location**: Line 54-59

```typescript
const maxOrder = await tx.order.findFirst({
  where: { orderNumber: { not: null } },
  orderBy: { orderNumber: 'desc' },
  select: { orderNumber: true },
})
```

**Impact**: ~100-500ms (depends on table size)
**Fix**: Use database sequence or cached counter

### 3. **Multiple Sequential Database Writes** ⚠️
**Location**: Lines 62-129

Currently doing 7 separate writes:
1. User update (wallet deduction)
2. Order create
3. Log create (order created)
4. Log create (payment processing)
5. Payment create
6. DataUsage create
7. Transaction create

**Impact**: ~200-1000ms total
**Fix**: Some can be batched or moved outside transaction

### 4. **Logging Inside Transaction** ⚠️
**Location**: Lines 82-93

Logging inside transaction adds overhead and risk of timeout
**Impact**: ~50-200ms per log entry
**Fix**: Move all logging outside transaction (already done for status changes)

---

## Optimization Opportunities

### Quick Wins (Easy to Implement)

#### 1. Remove Duplicate Order Lookup
**Savings**: ~50-200ms
**Risk**: Low

```typescript
// Instead of:
const order = await prisma.order.findUnique(...)
const orderForVtu = await prisma.order.findUnique(...)

// Do:
const orderId = order.id // Use from transaction
```

#### 2. Store Order ID from Transaction
**Savings**: ~50-200ms
**Risk**: Low

```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({...})
  orderRef = order.reference
  orderId = order.id // Store this!
  // ... rest of transaction
})

// Use orderId directly, no need to query again
```

#### 3. Move Logging Outside Transaction
**Savings**: ~100-400ms + reduces timeout risk
**Risk**: Low (already done for status changes)

Move `logOrderCreated` and `logPaymentProcessing` outside transaction.

#### 4. Optimize Order Number Generation
**Savings**: ~100-500ms
**Risk**: Medium (requires schema change)

Options:
- Use PostgreSQL sequence
- Use Redis counter
- Cache last order number

---

### Medium Effort Optimizations

#### 5. Batch Database Operations
**Savings**: ~200-500ms
**Risk**: Medium

Use `createMany` where possible, or combine operations.

#### 6. Connection Pooling
**Savings**: ~50-200ms per request
**Risk**: Low (configuration only)

Ensure Prisma connection pool is optimized.

#### 7. Parallel Operations
**Savings**: ~100-300ms
**Risk**: Low

Run independent operations in parallel:
```typescript
await Promise.all([
  tx.payment.create(...),
  tx.dataUsage.create(...),
  tx.transaction.create(...)
])
```

---

### Advanced Optimizations

#### 8. Background Job Queue
**Savings**: User sees response in <1 second
**Risk**: High (requires infrastructure)

Use queue system (Bull, BullMQ) for VTU processing.

#### 9. Database Indexes
**Savings**: ~50-200ms per query
**Risk**: Low

Ensure all foreign keys and frequently queried fields are indexed.

#### 10. Caching
**Savings**: ~100-500ms for repeated operations
**Risk**: Medium

Cache:
- User data
- Plan data
- Network settings

---

## Recommended Optimizations (Priority Order)

### Priority 1: Quick Wins (Implement First)
1. ✅ Remove duplicate order lookup
2. ✅ Store order ID from transaction
3. ✅ Move logging outside transaction
4. ✅ Parallelize independent operations

**Expected Improvement**: 200-800ms faster response time

### Priority 2: Medium Effort
5. Optimize order number generation
6. Batch database operations
7. Add database indexes

**Expected Improvement**: 300-1000ms faster response time

### Priority 3: Advanced (If Needed)
8. Background job queue
9. Caching layer
10. Database read replicas

**Expected Improvement**: User sees response in <1 second

---

## Current Performance Metrics

| Operation | Current Time | After Quick Wins | After All Optimizations |
|----------|--------------|------------------|-------------------------|
| Transaction | 1-3s | 0.5-2s | 0.3-1s |
| API Response | 1-3s | 0.5-2s | 0.3-1s |
| VTU API Call | 10-180s | 10-180s | 10-180s (unchanged) |
| Total User Wait | 1-3s | 0.5-2s | 0.3-1s |

**Note**: VTU API call time is external and cannot be optimized by us.

---

## Implementation Plan

### Phase 1: Quick Wins (30 minutes)
- Remove duplicate queries
- Store order ID from transaction
- Move logging outside transaction
- Parallelize operations

### Phase 2: Medium Optimizations (2-3 hours)
- Optimize order number generation
- Batch operations
- Review and add indexes

### Phase 3: Advanced (If Needed) (1-2 days)
- Implement job queue
- Add caching layer
- Performance testing

