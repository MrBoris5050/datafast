# Probability Analysis: Orders Not Sent to DataHub API (Manual Processing)

## Overview

An order will **NOT** be sent to the DataHub API and will be marked for **manual processing** (`isManual: true`) under the following conditions:

## Conditions Leading to Manual Processing

### 1. Configuration-Based Failures (100% Probability if Condition Met)

These are **deterministic** - if the condition exists, the order will ALWAYS be manual:

#### A. Network-Specific Settings Issues
- **Network is inactive**: `networkSetting.isActive === false`
  - Location: `src/lib/vtu.ts:51-57`
  - Probability: **100%** if network is marked inactive

- **No VTU source assigned**: `!networkSetting.vtuSourceId || !networkSetting.vtuSource`
  - Location: `src/lib/vtu.ts:61-74`
  - Probability: **100%** if no VTU source is configured for the network

- **VTU source is inactive**: `!source.active`
  - Location: `src/lib/vtu.ts:79-90`
  - Probability: **100%** if assigned VTU source is marked inactive

#### B. Default VTU Source Issues (Fallback)
- **No default VTU source found**: `!source` after checking both env vars and database
  - Location: `src/lib/vtu.ts:131-137`
  - Probability: **100%** if:
    - No `DATAHUBGH_API_KEY` environment variable set
    - No active VTU source in database with `isDefault: true` or `active: true`

- **Default VTU source is inactive**: `!source.active` (for database sources)
  - Location: `src/lib/vtu.ts:141-152`
  - Probability: **100%** if default source exists but is inactive

#### C. Unsupported Provider
- **Provider is not DATAHUBGH**: `source.provider !== 'DATAHUBGH'`
  - Location: `src/lib/vtu.ts:117-118, 179-180`
  - Probability: **100%** if VTU source uses unsupported provider

### 2. API Call Failures (Variable Probability)

These depend on DataHub API reliability, network conditions, and response times:

#### A. HTTP Response Failures
- **Non-OK HTTP status**: `!res.ok` (status codes 4xx, 5xx)
  - Location: `src/lib/providers/datahubgh.ts:124-134`
  - Probability: **Variable** - depends on DataHub API error rate
  - Common causes:
    - Invalid API key
    - Invalid request parameters
    - Server errors (500, 503, etc.)
    - Rate limiting (429)

#### B. Network/Connection Errors
- **Fetch exceptions**: Network failures, DNS errors, connection timeouts
  - Location: `src/lib/providers/datahubgh.ts:165-177`
  - Probability: **Variable** - typically low (< 1%) in stable environments
  - Common causes:
    - Internet connectivity issues
    - DataHub API server down
    - Firewall/proxy blocking requests

#### C. Timeout Errors
- **Request timeout**: 120 seconds exceeded
  - Location: `src/lib/providers/datahubgh.ts:93, 173-174`
  - Probability: **Variable** - depends on DataHub API response time
  - If DataHub API takes > 120 seconds, request is aborted

#### D. JSON Parsing Errors
- **Invalid JSON response**: Response cannot be parsed
  - Location: `src/lib/providers/datahubgh.ts:114-122`
  - Probability: **Very low** (< 0.1%) - only if DataHub API returns malformed JSON

#### E. Unhandled Exceptions
- **Any exception during VTU processing**: Caught in `.catch()` block
  - Location: `src/app/api/orders/purchase/route.ts:168-189`
  - Probability: **Very low** - unexpected errors in code execution

## Calculating Actual Probability

The actual probability depends on your system configuration and DataHub API reliability:

### Formula

```
P(Manual) = P(Config Failure) + P(API Failure) × (1 - P(Config Failure))
```

Where:
- **P(Config Failure)**: Probability of configuration issues (0% if all networks properly configured)
- **P(API Failure)**: Probability of DataHub API call failure (typically 1-5% in production)

### Example Scenarios

#### Scenario 1: Fully Configured System
- All networks have active VTU sources
- DataHub API has 99% uptime
- **Probability**: ~1-2% (only API failures)

#### Scenario 2: Partially Configured System
- 2 out of 4 networks have no VTU source
- 50% of orders go to unconfigured networks
- DataHub API has 99% uptime
- **Probability**: ~50% (50% config + 0.5% API failures on configured networks)

#### Scenario 3: Misconfigured System
- All networks marked inactive OR no default VTU source
- **Probability**: **100%** (all orders manual)

## How to Check Your System's Probability

### 1. Use VTU Diagnostics Endpoint
```bash
GET /api/admin/vtu-diagnostics
```
This shows:
- Network configuration status
- VTU source status
- Recent manual orders count
- Issues and recommendations

### 2. Query Database for Historical Data
```sql
-- Manual orders in last 7 days
SELECT 
  COUNT(*) FILTER (WHERE isManual = true) as manual_count,
  COUNT(*) as total_orders,
  ROUND(100.0 * COUNT(*) FILTER (WHERE isManual = true) / COUNT(*), 2) as manual_percentage
FROM "Order"
WHERE createdAt >= NOW() - INTERVAL '7 days';

-- Manual orders by network
SELECT 
  p.network,
  COUNT(*) FILTER (WHERE o.isManual = true) as manual_count,
  COUNT(*) as total_orders,
  ROUND(100.0 * COUNT(*) FILTER (WHERE o.isManual = true) / COUNT(*), 2) as manual_percentage
FROM "Order" o
JOIN "DataPlan" p ON o."planId" = p.id
WHERE o.createdAt >= NOW() - INTERVAL '7 days'
GROUP BY p.network;
```

### 3. Check Logs
Look for these log patterns:
- `[VTU] Network X is inactive, using manual processing`
- `[VTU] Network X is set to manual processing (no VTU source assigned)`
- `[DataHubGH] Purchase failed:`
- `[Order Purchase] VTU purchase failed for order X, marking as manual`

## Recommendations to Minimize Manual Processing

1. **Ensure all networks have active VTU sources configured**
   - Check `/api/admin/vtu-diagnostics` for network status
   - Configure `NetworkApiSetting` for each network

2. **Set up default VTU source**
   - Either set `DATAHUBGH_API_KEY` environment variable
   - Or create a default VTU source in database with `isDefault: true`

3. **Monitor DataHub API health**
   - Track API response times
   - Monitor error rates
   - Set up alerts for high failure rates

4. **Handle timeouts gracefully**
   - Current timeout is 120 seconds
   - Consider retry logic for transient failures

5. **Regular diagnostics**
   - Run `/api/admin/vtu-diagnostics` regularly
   - Review manual orders weekly
   - Address configuration issues promptly

## Code Locations

- **VTU Processing Logic**: `src/lib/vtu.ts`
- **DataHub API Client**: `src/lib/providers/datahubgh.ts`
- **Order Purchase Handler**: `src/app/api/orders/purchase/route.ts`
- **VTU Diagnostics**: `src/app/api/admin/vtu-diagnostics/route.ts`

