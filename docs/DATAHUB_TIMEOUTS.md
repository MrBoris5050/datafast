# DataHub API Timeout Settings

## Current Timeout Configuration

### 1. Purchase API Call
**Location**: `src/lib/providers/datahubgh.ts` (Line 129)

```typescript
const timeoutId = setTimeout(() => controller.abort(), 180000) // 180 seconds (3 minutes)
```

**Timeout**: **180 seconds (3 minutes)**

**What this means:**
- System waits up to **3 minutes** for DataHub to respond to purchase requests
- If DataHub doesn't respond within 3 minutes, the request is aborted
- Order is marked for manual processing if timeout occurs

**When it's used:**
- Every time an order is created and VTU processing starts
- Called asynchronously (doesn't block user response)

---

### 2. Status Check API Call
**Location**: `src/lib/providers/datahubgh.ts` (Line 377)

```typescript
const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds (1 minute)
```

**Timeout**: **60 seconds (1 minute)**

**What this means:**
- System waits up to **1 minute** for DataHub to respond to status check requests
- This is only used if explicitly called (not automatic during purchase flow)

**When it's used:**
- Manual status checks (if implemented)
- Not part of the standard purchase flow

---

## Timeout Behavior

### Purchase API Timeout Flow

```
Order Created
    ↓
VTU API Call Started
    ↓
[Wait up to 180 seconds for DataHub response]
    ↓
┌─────────────────────────────┐
│  Response Received?         │
└─────────────────────────────┘
    │                    │
    YES                  NO (Timeout after 180s)
    ↓                    ↓
Success Logged      Timeout Error Logged
Order Updated       Order Marked Manual
                    isManual: true
```

### What Happens on Timeout

1. **Request Aborted**: Fetch request is cancelled after 180 seconds
2. **Error Logged**: Timeout error is logged with full details
3. **Order Status**: Order marked as `isManual: true` and `status: PENDING`
4. **Admin Notification**: Order appears in admin panel for manual processing

### Timeout Error Details

When timeout occurs, the log will show:
```json
{
  "errorType": "TIMEOUT",
  "endpoint": "https://user.datahubgh.com/api/external/data-purchase",
  "timeoutMs": 180000,
  "message": "Request timeout: VTU provider did not respond in time"
}
```

---

## Why 180 Seconds?

**Reasoning:**
- DataHub API can sometimes take longer to process requests
- Network conditions may cause delays
- 3 minutes provides reasonable buffer for slow responses
- Prevents orders from timing out too quickly
- Still prevents indefinite hanging

**Previous Settings:**
- Originally: 120 seconds (2 minutes)
- Updated to: 180 seconds (3 minutes) for better reliability

---

## Can It Be Changed?

Yes, you can adjust the timeout in `src/lib/providers/datahubgh.ts`:

```typescript
// Line 129 - Purchase API timeout
const timeoutId = setTimeout(() => controller.abort(), 180000) // Change this value

// Line 377 - Status check timeout  
const timeoutId = setTimeout(() => controller.abort(), 60000) // Change this value
```

**Recommendations:**
- **Don't go below 120 seconds**: DataHub may need time to process
- **Don't go above 300 seconds (5 minutes)**: Too long can cause issues
- **180 seconds (3 minutes) is optimal**: Good balance between waiting and preventing hangs

---

## Impact on User Experience

**User doesn't wait for this timeout:**
- API returns immediately to user (typically 1-2 seconds)
- VTU processing happens in background
- User sees "Order is being processed" message
- Order status updates later via webhook or manual processing

**If timeout occurs:**
- User already received success message
- Order is marked for manual processing
- Admin can process manually or retry
- No impact on user's immediate experience

---

## Summary

| API Call | Timeout | When Used |
|----------|---------|-----------|
| **Purchase API** | **180 seconds (3 minutes)** | Every order purchase |
| **Status Check API** | **60 seconds (1 minute)** | Manual status checks only |

**Current Setting**: System waits **3 minutes** for DataHub purchase API responses.

