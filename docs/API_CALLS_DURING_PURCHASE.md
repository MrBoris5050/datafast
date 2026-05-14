# API Calls Triggered During Purchase

This document outlines all external API calls that are triggered when a user makes a data purchase.

## Purchase Flow Overview

When a user purchases data, the following API calls are made. **Note**: The flow differs based on payment method:

### Wallet Purchase Flow
When user pays with wallet balance (no external payment gateway)

### Paystack Purchase Flow  
When user pays with Paystack (card/bank transfer)

---

## API Calls for Wallet Purchase

## API Calls for Paystack Purchase

### 1. **Paystack API - Initialize Payment** ⏱️ No explicit timeout
- **When**: Before order creation (user clicks "Pay with Paystack")
- **Endpoint**: `POST https://api.paystack.co/transaction/initialize`
- **Location**: `src/lib/paystack.ts` → `initializePayment()`
- **Purpose**: Initialize payment with Paystack and get authorization URL
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "amount": 10000, // in pesewas (GHS * 100)
    "reference": "FS-XXXXXXXX",
    "callback_url": "https://yourapp.com/payment/callback",
    "metadata": {
      "orderId": "{orderId}",
      "planId": "{planId}",
      "phoneNumber": "233XXXXXXXXX"
    }
  }
  ```
- **Headers**:
  - `Authorization: Bearer {PAYSTACK_SECRET_KEY}`
  - `Content-Type: application/json`
- **Response**: Returns `authorizationUrl` for user to complete payment

### 2. **Paystack API - Verify Payment** ⏱️ No explicit timeout
- **When**: After user completes payment (via callback or webhook)
- **Endpoint**: `GET https://api.paystack.co/transaction/verify/{reference}`
- **Location**: `src/lib/paystack.ts` → `verifyPayment()`
- **Purpose**: Verify payment status with Paystack
- **Headers**:
  - `Authorization: Bearer {PAYSTACK_SECRET_KEY}`
- **Triggered From**:
  - `src/app/api/payment/verify/route.ts` (manual verification)
  - `src/app/api/webhooks/paystack/route.ts` (webhook verification)

### 3. **Paystack Webhook** (Incoming)
- **When**: Paystack sends payment status updates
- **Endpoint**: `POST /api/webhooks/paystack`
- **Location**: `src/app/api/webhooks/paystack/route.ts`
- **Purpose**: Receive payment status updates from Paystack
- **Events**: `charge.success`, `charge.failed`, etc.
- **Actions Triggered**:
  - Creates order if payment successful
  - Credits wallet (for top-ups)
  - Triggers VTU purchase (for data purchases)
  - Sends SMS notifications

---

## API Calls for Wallet Purchase

### 1. **DataHubGH API - Purchase Request** ⏱️ 60s timeout
- **When**: Immediately after order creation (asynchronously)
- **Endpoint**: `POST {baseUrl}/external/data-purchase`
- **Location**: `src/lib/providers/datahubgh.ts` → `datahubPurchase()`
- **Timeout**: 60 seconds (recently increased from 30s)
- **Purpose**: Sends the data purchase request to DataHubGH
- **Request Body**:
  ```json
  {
    "networkKey": "YELLO|TELECEL|AT_PREMIUM|AT_BIGTIME",
    "recipient": "233XXXXXXXXX",
    "capacity": "1" // GB as string
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `X-API-Key: {apiKey}`
- **Response**: Returns `providerReference` if successful

### 2. **DataHubGH API - Status Check** ⏱️ 30s timeout (Optional)
- **When**: Only if explicitly called (not automatic during purchase)
- **Endpoint**: `POST {baseUrl}/external/transaction-status`
- **Location**: `src/lib/providers/datahubgh.ts` → `datahubCheckStatus()`
- **Timeout**: 30 seconds (recently increased from 15s)
- **Purpose**: Check the status of a transaction
- **Request Body**:
  ```json
  {
    "reference": "{providerReference}"
  }
  ```
- **Note**: This is typically not called during the initial purchase flow, but may be used for status verification

### 3. **Arkesel SMS API - Success Notification** ⏱️ No explicit timeout
- **When**: After order status changes to `COMPLETED` (via webhook)
- **Endpoint**: `POST https://sms.arkesel.com/api/v2/sms/send`
- **Location**: `src/lib/arkesel.ts` → `sendSmsViaArkesel()`
- **Purpose**: Send SMS notification to user when order completes
- **Request Body**:
  ```json
  {
    "sender": "Inventor Datahub",
    "message": "Data purchase successful: {planName} for {phone}. Amount: GHS {amount}. Ref: {reference}",
    "recipients": ["233XXXXXXXXX"]
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `api-key: {ARKESEL_API_KEY}`
- **Triggered From**:
  - `src/app/api/webhooks/datahubgh/route.ts` (when webhook marks order as COMPLETED)
  - `src/app/api/admin/orders/[id]/update-status/route.ts` (when admin manually completes order)
  - `src/app/api/admin/orders/bulk-update-status/route.ts` (when admin bulk completes orders)

### 4. **Arkesel SMS API - Failure Notification** ⏱️ No explicit timeout
- **When**: After order status changes to `FAILED` (via webhook)
- **Endpoint**: `POST https://sms.arkesel.com/api/v2/sms/send`
- **Location**: `src/lib/arkesel.ts` → `sendSmsViaArkesel()`
- **Purpose**: Send SMS notification to user when order fails
- **Message**: "Data purchase failed: {planName}. Refund of GHS {amount} has been credited to your wallet. Ref: {reference}"
- **Triggered From**: `src/app/api/webhooks/datahubgh/route.ts` (when webhook marks order as FAILED)

### 5. **Developer Webhooks** ⏱️ 10s timeout per webhook
- **When**: When order status changes (if user has active webhook subscriptions)
- **Endpoint**: User-defined webhook URLs
- **Location**: `src/lib/webhooks.ts` → `sendOrderWebhooks()`
- **Timeout**: 10 seconds per webhook
- **Purpose**: Notify developer applications about order status changes
- **Request Body**:
  ```json
  {
    "event": "order.completed|order.failed|order.processing",
    "data": {
      "id": "{orderId}",
      "reference": "{reference}",
      "status": "COMPLETED|FAILED|PROCESSING",
      "amount": 10.00,
      "phone": "233XXXXXXXXX",
      "providerReference": "{providerReference}",
      "plan": {
        "id": "{planId}",
        "name": "1GB Data",
        "dataAmount": 1024,
        "dataAmountGB": "1.00",
        "network": "MTN",
        "validity": "30"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `X-Webhook-Signature: {hmac-sha256-signature}`
  - `X-Webhook-Event: {event-name}`
- **Triggered From**:
  - `src/app/api/admin/orders/bulk-update-status/route.ts` (bulk status updates)
  - Any order status change (if webhook subscriptions exist)

## Incoming Webhook (DataHubGH → Your System)

### 6. **DataHubGH Webhook** (Incoming)
- **When**: DataHubGH sends status updates about orders
- **Endpoint**: `POST /api/webhooks/datahubgh`
- **Location**: `src/app/api/webhooks/datahubgh/route.ts`
- **Purpose**: Receive order status updates from DataHubGH
- **Expected Payload**:
  ```json
  {
    "event": "order.completed|order.failed",
    "data": {
      "reference": "{providerReference}",
      "status": "SUCCESSFUL|FAILED",
      "statusDescription": "Description",
      "network": "MTN",
      "recipient": "233XXXXXXXXX",
      "dataAmount": 1024,
      "amountPaid": 10.00,
      "orderDate": "2024-01-01T00:00:00.000Z"
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```
- **Headers**:
  - `x-signature` or `x-datahubgh-signature` (optional, for verification)
- **Actions Triggered**:
  - Updates order status in database
  - Sends SMS notification (if status is COMPLETED or FAILED)
  - Updates payment and transaction records

## API Call Sequence Diagrams

### Wallet Purchase Flow
```
User Purchase Request (Wallet)
    ↓
[1] Create Order in Database
    ↓
[2] DataHubGH Purchase API (async, 60s timeout)
    ├─→ Success → Order status: PROCESSING
    └─→ Failure → Order status: PENDING, isManual: true
    ↓
[3] DataHubGH Webhook (incoming, when ready)
    ├─→ COMPLETED → [4] Send Success SMS
    └─→ FAILED → [5] Send Failure SMS + Refund
    ↓
[6] Developer Webhooks (if subscribed)
    └─→ POST to user's webhook URLs (10s timeout each)
```

### Paystack Purchase Flow
```
User Purchase Request (Paystack)
    ↓
[1] Paystack Initialize Payment API
    └─→ Returns authorizationUrl
    ↓
[2] User Redirects to Paystack
    └─→ User completes payment
    ↓
[3] Paystack Webhook (incoming)
    ├─→ charge.success → [4] Create Order → [5] DataHubGH Purchase API
    └─→ charge.failed → Payment failed
    ↓
[6] DataHubGH Purchase API (async, 60s timeout)
    ├─→ Success → Order status: PROCESSING
    └─→ Failure → Order status: PENDING, isManual: true
    ↓
[7] DataHubGH Webhook (incoming, when ready)
    ├─→ COMPLETED → [8] Send Success SMS
    └─→ FAILED → [9] Send Failure SMS + Refund
    ↓
[10] Developer Webhooks (if subscribed)
    └─→ POST to user's webhook URLs (10s timeout each)
```

## Timeout Summary

| API Call | Timeout | Location |
|----------|---------|----------|
| Paystack Initialize | None (uses fetch default) | `src/lib/paystack.ts:34` |
| Paystack Verify | None (uses fetch default) | `src/lib/paystack.ts:53` |
| DataHubGH Purchase | 60s | `src/lib/providers/datahubgh.ts:93` |
| DataHubGH Status Check | 30s | `src/lib/providers/datahubgh.ts:212` |
| Arkesel SMS | None (uses fetch default) | `src/lib/arkesel.ts:42` |
| Developer Webhooks | 10s per webhook | `src/lib/webhooks.ts:95` |

## Configuration

### Environment Variables

```env
# Paystack
PAYSTACK_PUBLIC_KEY="your-paystack-public-key"
PAYSTACK_SECRET_KEY="your-paystack-secret-key"

# DataHubGH
DATAHUBGH_API_KEY="your-api-key"
DATAHUBGH_BASE_URL="https://user.datahubgh.com/api"
USE_ENV_FOR_VTU="true"

# Arkesel SMS
ARKESEL_API_KEY="your-arkesel-api-key"
ARKESEL_SENDER_ID="Inventor Datahub"
ARKESEL_SMS_URL="https://sms.arkesel.com/api/v2/sms/send"

# Webhook Secrets
DATAHUBGH_WEBHOOK_SECRET="your-datahubgh-webhook-secret"
PAYSTACK_WEBHOOK_SECRET="your-paystack-webhook-secret"
```

## Error Handling

- **DataHubGH Purchase Failure**: Order marked as `isManual: true`, status `PENDING`
- **SMS Failure**: Logged but doesn't affect order processing
- **Webhook Failure**: Logged but doesn't affect order processing
- **Timeout**: Request aborted, order marked as manual

## Notes

1. **Asynchronous Processing**: The DataHubGH purchase call is made asynchronously, so the API returns immediately while processing happens in the background.

2. **SMS Notifications**: SMS is only sent when order status changes to COMPLETED or FAILED, typically via webhook from DataHubGH.

3. **Webhook Subscriptions**: Developer webhooks are only sent if the user has active webhook subscriptions configured.

4. **No Retry Logic**: Currently, there's no automatic retry logic for failed API calls. Failed purchases are marked as manual for admin review.

