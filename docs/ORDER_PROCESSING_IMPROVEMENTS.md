# Order Processing Improvements

This document outlines the improvements made to the order processing flow.

## Summary of Improvements

### 1. Idempotency Protection
**Files:** `src/app/api/orders/purchase/route.ts`, `src/app/api/developer/purchase/route.ts`

- Prevents duplicate orders when user double-clicks or network issues cause retries
- 60-second idempotency window for same user/plan/phone combination
- Returns existing order reference instead of creating duplicate

```typescript
// Idempotency check
const existingOrder = await prisma.order.findFirst({
  where: {
    userId: user.id,
    planId: plan.id,
    phone: normalizedPhone,
    createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) }
  }
})
```

### 2. Retry Logic with Exponential Backoff
**Files:** `src/lib/retry.ts`, `src/lib/providers/datahubgh.ts`

- Automatic retry (up to 3 attempts) for transient failures
- Exponential backoff: 2s → 4s → 8s delays
- Smart retry detection: Only retries network errors, timeouts, 5xx errors
- Does NOT retry 4xx client errors (except 429 rate limiting)

```typescript
// Retry configuration
{
  maxRetries: 2, // Total 3 attempts
  initialDelay: 2000, // 2 seconds
  maxDelay: 10000, // 10 seconds max
  backoffMultiplier: 2
}
```

### 3. Circuit Breaker
**Files:** `src/lib/circuit-breaker.ts`, `src/lib/providers/datahubgh.ts`

- Prevents cascading failures when VTU provider is down
- States: CLOSED (normal) → OPEN (blocking) → HALF_OPEN (testing)
- Threshold: 5 failures opens circuit
- Recovery: 60 seconds before attempting again

```typescript
// Circuit breaker states
CLOSED → Normal operation, requests pass through
OPEN → 5+ failures, requests fail immediately (60s cooldown)
HALF_OPEN → Testing recovery, limited requests allowed
```

**Admin API:** `GET/POST /api/admin/vtu-health`
- View circuit breaker stats
- Reset circuit breaker manually

### 4. Phone Number Validation
**File:** `src/lib/phone-validation.ts`

- Validates Ghana phone numbers
- Accepts formats: `0XXXXXXXXX`, `233XXXXXXXXX`, `+233XXXXXXXXX`
- Normalizes to international format: `233XXXXXXXXX`
- Validates network prefixes (02X, 05X)

```typescript
const { valid, normalized, error } = validateGhanaPhone('0201234567')
// normalized: '233201234567'
```

### 5. Notification Fallback System
**File:** `src/lib/notifications.ts`

- Multi-channel notifications: SMS, Email, In-App
- Continues if one channel fails
- Reports success/failure for each channel

```typescript
// Notification channels
1. SMS via Arkesel
2. Email via configured SMTP
3. In-App notification (stored in database)
```

### 6. Stuck Orders Checker
**Files:** `src/lib/stuck-orders.ts`, `src/app/api/admin/stuck-orders/route.ts`

- Detects orders stuck in PROCESSING state (>5 minutes)
- Checks status with VTU provider
- Auto-marks as manual if provider check fails
- Admin API for manual triggering

**Admin API:**
```bash
# List stuck orders
GET /api/admin/stuck-orders

# Get count only
GET /api/admin/stuck-orders?action=count

# Check and update stuck orders
GET /api/admin/stuck-orders?action=check

# Custom check
POST /api/admin/stuck-orders
{
  "stuckThreshold": 300000,  // 5 minutes in ms
  "batchSize": 50,
  "autoMarkManual": true
}
```

### 7. Transaction Optimizations
**Files:** `src/app/api/orders/purchase/route.ts`, `src/app/api/developer/purchase/route.ts`

- Removed unnecessary transaction wrappers for single updates
- Reduced timeout from 180s to 60s (with retry)
- Query optimization: Return new balance from transaction instead of re-querying

### 8. Reference Deduplication (Developer API)
**File:** `src/app/api/developer/purchase/route.ts`

- Checks for existing orders with same reference
- Returns HTTP 409 Conflict with existing order details
- Prevents duplicate charges for same transaction

## Timeout Configuration

| Operation | Timeout | Retries |
|-----------|---------|---------|
| VTU API Call | 60s | 2 (total 3 attempts) |
| Database Transaction | 30s | N/A |
| Status Check | 60s | N/A |
| Circuit Breaker Recovery | 60s | N/A |

## Error Handling Flow

```
User Purchase Request
    ↓
[1] Validate phone number → Invalid? Return 400
    ↓
[2] Idempotency check → Duplicate? Return existing order
    ↓
[3] Check balance → Insufficient? Return 400
    ↓
[4] Create order (transaction)
    ↓
[5] Return success to user (async)
    ↓
[6] VTU Processing (background)
    ├─ Circuit breaker OPEN? → Mark order for retry later
    ├─ API call with retry (up to 3 attempts)
    │   ├─ Success → Update order with providerReference
    │   └─ Failure (after retries)
    │       ├─ Timeout? → Keep PROCESSING (wait for webhook)
    │       └─ Other error → Mark as manual
    ↓
[7] Webhook confirmation
    ├─ COMPLETED → Notify user (SMS, Email, In-App)
    └─ FAILED → Refund + Notify user
```

## Monitoring

### VTU Health Dashboard
```bash
GET /api/admin/vtu-health
```

Returns:
- Circuit breaker states
- Recent order statistics
- VTU source status
- Network configuration

### Stuck Orders
```bash
GET /api/admin/stuck-orders
```

Returns:
- Count of stuck orders
- Order details
- Time stuck

## Configuration

### Environment Variables
```env
# VTU Provider
DATAHUBGH_API_KEY=your-api-key
DATAHUBGH_BASE_URL=https://user.datahubgh.com/api

# Timeouts (optional, defaults shown)
VTU_TIMEOUT_MS=60000
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_MS=60000
IDEMPOTENCY_WINDOW_MS=60000
```

## Migration Notes

No database migrations required. All improvements are backward compatible.

## Testing Recommendations

1. **Idempotency**: Submit same order twice within 60 seconds
2. **Retry Logic**: Simulate network failure, verify retry behavior
3. **Circuit Breaker**: Generate 5+ failures, verify circuit opens
4. **Phone Validation**: Test various phone formats
5. **Stuck Orders**: Create a PROCESSING order, wait 5+ minutes, run check
