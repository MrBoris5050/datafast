/**
 * Provider dispatch — single entry point for fulfilling a data order.
 *
 * Provider is resolved from Network.apiProvider.
 * Supported values:  "DATAHUBGH" | "DATADASHGH" | "DATAWAVEGH" | "HUBNETGH" | "MANUAL" | null
 *
 * Returns a ProviderResult and updates the Order row accordingly.
 * Designed to run inside Next.js after() — never blocks the HTTP response.
 */

import { prisma } from '@/lib/db'
import {
  logOrderEvent,
  logStatusChange,
  logVtuApiCall,
  logVtuApiSuccess,
  logVtuApiFailure,
  logManualProcessing,
} from '@/lib/order-logs'

export type NetworkConfig = {
  apiProvider: string | null
  apiKey: string | null
  baseUrl: string | null
  providerNetworkKey: string | null
}

export type DispatchInput = {
  orderId: string
  reference: string
  network: NetworkConfig
  phone: string
  dataAmountMB: number
  planName: string
  /** DataPlan.network (e.g. MTN) — used with DATADASHGH_PLAN_MAP fallback. */
  planNetwork?: string | null
  /** Required for DATADASHGH — upstream bundle id (`plan_id`). */
  providerPlanId?: string | null
}

export type ProviderResult = {
  success: boolean
  providerReference?: string
  isManual?: boolean
  error?: string
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function dispatchToProvider(input: DispatchInput): Promise<ProviderResult> {
  const provider = input.network.apiProvider?.toUpperCase() ?? 'MANUAL'

  switch (provider) {
    case 'DATAHUBGH':
      return callDataHub(input)

    case 'DATADASHGH':
      return callDataDash(input)

    case 'DATAWAVEGH':
      return callDataWave(input)

    case 'HUBNETGH':
      return callHubnet(input)

    case 'MANUAL':
    default:
      await markManual(input.orderId, 'No provider configured for network')
      return { success: false, isManual: true, error: 'No provider configured — queued for manual processing' }
  }
}

// ─── DataHubGH ───────────────────────────────────────────────────────────────

async function callDataHub(input: DispatchInput): Promise<ProviderResult> {
  const { orderId, reference, network, phone, dataAmountMB } = input

  // Prefer env vars — the same DataHub account covers all networks.
  // DB values (network.apiKey / network.baseUrl) are used as fallback only.
  const baseUrl = (
    process.env.DATAHUBGH_BASE_URL ?? network.baseUrl ?? 'https://user.datahubgh.com/api'
  ).replace(/\/$/, '')
  const apiKey = process.env.DATAHUBGH_API_KEY ?? network.apiKey ?? ''
  const networkKey = network.providerNetworkKey ?? ''
  const capacity   = String(Math.max(1, Math.round(dataAmountMB / 1024))) // MB → GB string

  if (!networkKey) {
    await markManual(orderId, 'providerNetworkKey not set on Network')
    return { success: false, isManual: true, error: 'providerNetworkKey not configured' }
  }

  const endpoint = `${baseUrl}/external/data-purchase`
  const requestBody = { networkKey, recipient: phone, capacity }

  const MAX_ATTEMPTS = 3
  const RETRY_DELAYS_MS = [0, 3_000, 6_000]
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt])
      await logOrderEvent(orderId, `Retrying DataHub API call (attempt ${attempt + 1}/${MAX_ATTEMPTS})`, 'WARNING', {
        attempt: attempt + 1,
        delayMs: RETRY_DELAYS_MS[attempt],
        lastError,
        networkKey,
      })
    }

    // Log each outgoing API call
    await logVtuApiCall(orderId, 'DataHubGH', endpoint, { networkKey, phone, capacity, attempt: attempt + 1 }, requestBody)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000) // 30 s per attempt

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body:    JSON.stringify(requestBody),
        signal:  controller.signal,
      })
      clearTimeout(timer)

      const json = await res.json().catch(() => null)

      // ── Success ──────────────────────────────────────────────────────────
      if (res.ok && (json?.success || res.status === 200)) {
        const providerRef =
          json?.data?.reference ??
          json?.data?.orderNumber ??
          json?.data?.id ??
          reference

        await logVtuApiSuccess(orderId, 'DataHubGH', String(providerRef), {
          networkKey,
          responseStatus: json?.data?.status,
          attempt: attempt + 1,
        })

        await prisma.order.update({
          where: { id: orderId },
          data:  { providerReference: String(providerRef), isManual: false },
        })
        await logStatusChange(orderId, 'PROCESSING', 'PROCESSING', {
          note: 'Provider accepted order',
          providerReference: String(providerRef),
        })
        return { success: true, providerReference: String(providerRef) }
      }

      // ── 4xx: bad request / auth — no point retrying ───────────────────
      if (res.status >= 400 && res.status < 500) {
        const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`
        await logVtuApiFailure(orderId, 'DataHubGH', msg, { networkKey, attempt: attempt + 1 }, {
          httpStatus:   res.status,
          httpStatusText: res.statusText,
          errorType:    'HTTP_ERROR',
          endpoint,
          requestBody,
          responseBody: json,
        })
        await markManual(orderId, `DataHub rejected request (${res.status}): ${msg}`)
        return { success: false, isManual: true, error: msg }
      }

      // ── 5xx: transient — log and retry ───────────────────────────────
      lastError = json?.message ?? json?.error ?? `HTTP ${res.status}`
      await logVtuApiFailure(orderId, 'DataHubGH', lastError, { networkKey, attempt: attempt + 1 }, {
        httpStatus:    res.status,
        httpStatusText: res.statusText,
        errorType:     'HTTP_ERROR',
        endpoint,
        requestBody,
        responseBody:  json,
      })
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError'
      lastError = isTimeout ? 'Request timed out after 30s' : (e.message ?? 'Network error')

      await logVtuApiFailure(orderId, 'DataHubGH', lastError, { networkKey, attempt: attempt + 1 }, {
        errorType:    isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        errorName:    e.name,
        errorMessage: e.message,
        timeoutMs:    isTimeout ? 30_000 : undefined,
        endpoint,
        requestBody,
      })

      if (isTimeout) {
        // Request reached DataHub — webhook will confirm. Don't retry.
        await logOrderEvent(orderId,
          'API request timed out. Request was sent — waiting for webhook confirmation.',
          'WARNING', { networkKey, timeoutMs: 30_000 })
        return { success: false, error: lastError }
      }
    }
  }

  // All attempts exhausted — leave in PROCESSING, webhook/cron resolves.
  await logOrderEvent(orderId,
    `All ${MAX_ATTEMPTS} DataHub attempts failed. Order stays in PROCESSING — webhook or cron will resolve.`,
    'ERROR', { lastError, networkKey, attempts: MAX_ATTEMPTS })

  return { success: false, error: lastError }
}

// ─── DataDash GH (agents API) ────────────────────────────────────────────────
// POST /orders with JSON body: { plan_id, recipient } — Bearer token auth.
//
// Plan id resolution:
// 1) DataPlan.providerPlanId (admin Data Plans)
// 2) DATADASHGH_PLAN_MAP env — JSON object, keys "NETWORK_KEY:MB" e.g. {"MTN:1024":"abc..."}
//    MB should match the plan's data amount; we also try binary vs decimal GB (1024 vs 1000 per GB).
// 3) Built-in plan_ids (DataDash catalog) for MTN, AIRTEL-TIGO, TELECEL when network key / plan network match.
//    Override any time via DataPlan.providerPlanId or DATADASHGH_PLAN_MAP.

/** MTN — Master Internet */
const DATADASH_BUILTIN_MTN_MASTER_GB: Record<number, string> = {
  1: '722ed192edec33a955e42b6768f11d02',
  2: 'b8ae3bfbfd7a76f9f2daf124278413f5',
  3: '338ca5c593472fb9b0801feda9d0c740',
  4: '3be5554c02b9a2dc307b04fb7afc00d5',
  5: 'cc0a20dea874aa561e4fbf7e733e18ff',
  6: 'cec66b5386080f11ff2df484702ce4c5',
  8: '14f902aa9bd9cdcbaba30d1a30fd3e7e',
  10: 'd3783dd34fc8cc9835d64880c86cf72a',
  15: '056737d10a60be68a26214eb515de089',
  20: 'd99acfaa76ed811d0cc692d0641652b7',
  25: '59e0c9f3da438bdc1076a9b233bc6c54',
  30: 'b7779d100639f0baf753f2e7ca85291d',
  40: 'c95996ad0691b30bcd1e55b46ffb80e4',
  50: '5fa823f3f642b2bea8687b1a97275dc5',
}

/**
 * AIRTEL-TIGO — Premium (iShare) for 1–10GB; Big Time for 15–100GB (non-overlapping SKUs in DataDash catalog).
 */
const DATADASH_BUILTIN_AIRTEL_TIGO_GB: Record<number, string> = {
  1: '5f5d670197278900aa8c84855bbec91f',
  2: '95cdb39fc9ee36487cab395dce810cf0',
  3: 'a3156709ea4aceb0b54720fdf5187648',
  4: '7314f8307a255bb2a902c63cf0f6f4a5',
  5: '872d7dc280f61ad35f4693efb5592a7c',
  6: '27eb8a331e6dd0ccda694da861244754',
  7: '3c2b41e6172915cc73a417ecaef3be53',
  8: '15f098e26748839741e0f8f7c8626f34',
  9: 'cc7571d282165b4026c700eb27b2194d',
  10: 'c1192c381e0dd01b2df5bc66e1a9f13f',
  15: 'ed050633340636f27d82da69c1b18e57',
  20: '1e0bcaecc9ae5f3e0d1af890194bedce',
  30: '277a1753d5b60336265fa558169e5efa',
  40: 'bfb380aae06d171b6cd2faf97b856b43',
  50: '17da9bc1fb9398d12929ce3fba25c8ba',
  100: '4604b0a82beb266c2786596c5863e29d',
}

/** TELECEL */
const DATADASH_BUILTIN_TELECEL_GB: Record<number, string> = {
  10: '3a2ef759371800ca453afcc9f6c5e887',
  12: 'dd948e50a9a89db0c798fe3eae44a7c3',
  15: '959a90eea9f5a0bef86c64f04cedb15e',
  20: '83afc0010e0b9ed1fe4292450e921f0a',
  25: '4b947a69130b61f8c3494bb0f2658096',
  30: '3a7aee169f91ce40cc7ca67ae965245d',
  40: '6a343c4bd27a8033b0c535e4aa58c6de',
  50: 'e378800124a01071186d018a5b8e548d',
  100: 'cd5a2ba0e4615b5d994bdd1c4ab27edd',
}

let datadashPlanMapCache: Record<string, string> | null | undefined

function getDatadashPlanMap(): Record<string, string> | null {
  if (datadashPlanMapCache !== undefined) return datadashPlanMapCache
  const raw = process.env.DATADASHGH_PLAN_MAP?.trim()
  if (!raw) {
    datadashPlanMapCache = null
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    datadashPlanMapCache =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : null
  } catch {
    datadashPlanMapCache = null
  }
  return datadashPlanMapCache
}

/** MB values to try so 1GB plans stored as 1000 or 1024 both match env maps. */
function dataAmountMbAliases(mb: number): number[] {
  const m = Math.round(mb)
  const out = new Set<number>([m])
  const gbBin = Math.round(m / 1024)
  if (gbBin >= 1) {
    out.add(gbBin * 1024)
    out.add(gbBin * 1000)
  }
  const gbDec = Math.round(m / 1000)
  if (gbDec >= 1 && gbDec <= 256) {
    out.add(gbDec * 1000)
    out.add(gbDec * 1024)
  }
  return [...out]
}

function buildDatadashMapKeyCandidates(
  providerNetworkKey: string | null,
  planNetwork: string | null,
  mb: number
): string[] {
  const keys: string[] = []
  const pk = providerNetworkKey?.toUpperCase().trim()
  if (pk) keys.push(`${pk}:${mb}`)

  const raw = (planNetwork ?? '').trim()
  if (raw) {
    const u = raw.toUpperCase()
    keys.push(`${u}:${mb}`)
    const compact = u.replace(/\s+/g, '')
    if (compact !== u) keys.push(`${compact}:${mb}`)
    if (['ATISHARE', 'AIRTELTIGO', 'AIRTEL-TIGO'].includes(compact.replace(/-/g, ''))) {
      keys.push(`AIRTEL-TIGO:${mb}`)
    }
  }
  return keys
}

function resolveDataDashPlanIdFromMap(
  providerNetworkKey: string | null,
  planNetwork: string | null,
  dataAmountMB: number
): string | null {
  const map = getDatadashPlanMap()
  if (!map) return null

  const mbAliases = dataAmountMbAliases(dataAmountMB)
  for (const mb of mbAliases) {
    const keyCandidates = buildDatadashMapKeyCandidates(providerNetworkKey, planNetwork, mb)
    for (const k of keyCandidates) {
      if (map[k]) return map[k]
    }
  }
  return null
}

function inferBundleGbFromMb(mb: number): number | null {
  const m = Math.round(mb)
  if (m <= 0) return null
  const a = m / 1024
  const b = m / 1000
  const ra = Math.round(a)
  const rb = Math.round(b)
  if (ra >= 1 && Math.abs(a - ra) < 0.12) return ra
  if (rb >= 1 && Math.abs(b - rb) < 0.12) return rb
  if (ra >= 1) return ra
  if (rb >= 1) return rb
  return null
}

function resolveDataDashBuiltinMtn(dataAmountMB: number): string | null {
  const gb = inferBundleGbFromMb(dataAmountMB)
  if (gb == null || gb < 1) return null
  return DATADASH_BUILTIN_MTN_MASTER_GB[gb] ?? null
}

function resolveDataDashBuiltinAirtelTigo(dataAmountMB: number): string | null {
  const gb = inferBundleGbFromMb(dataAmountMB)
  if (gb == null || gb < 1) return null
  return DATADASH_BUILTIN_AIRTEL_TIGO_GB[gb] ?? null
}

function resolveDataDashBuiltinTelecel(dataAmountMB: number): string | null {
  const gb = inferBundleGbFromMb(dataAmountMB)
  if (gb == null || gb < 1) return null
  return DATADASH_BUILTIN_TELECEL_GB[gb] ?? null
}

function isMtnDataDashContext(providerNetworkKey: string | null, planNetwork: string | null): boolean {
  const pk = (providerNetworkKey ?? '').toUpperCase().trim()
  const pn = (planNetwork ?? '').toUpperCase().trim()
  return pk === 'MTN' || pn === 'MTN'
}

function isAirtelTigoDataDashContext(providerNetworkKey: string | null, planNetwork: string | null): boolean {
  const pk = (providerNetworkKey ?? '').toUpperCase().trim().replace(/-/g, '')
  if (pk === 'AIRTELTIGO') return true
  const pn = (planNetwork ?? '').toUpperCase().trim()
  if (['AT ISHARE', 'AT BIGTIME', 'AT BIG TIME', 'AIRTELTIGO', 'AIRTEL TIGO', 'AIRTEL-TIGO'].includes(pn)) return true
  if (pn.replace(/\s+/g, '') === 'ATISHARE' || pn.replace(/\s+/g, '') === 'ATBIGTIME') return true
  return pn.includes('AIRTEL') && pn.includes('TIGO')
}

function isTelecelDataDashContext(providerNetworkKey: string | null, planNetwork: string | null): boolean {
  const pk = (providerNetworkKey ?? '').toUpperCase().trim()
  const pn = (planNetwork ?? '').toUpperCase().trim()
  return pk === 'TELECEL' || pn === 'TELECEL' || pn === 'VODAFONE'
}

type BuiltinCatalog = 'MTN' | 'AIRTEL-TIGO' | 'TELECEL'

function resolveDataDashBuiltin(
  providerNetworkKey: string | null,
  planNetwork: string | null,
  dataAmountMB: number
): { planId: string; catalog: BuiltinCatalog } | null {
  if (isMtnDataDashContext(providerNetworkKey, planNetwork)) {
    const planId = resolveDataDashBuiltinMtn(dataAmountMB)
    return planId ? { planId, catalog: 'MTN' } : null
  }
  if (isAirtelTigoDataDashContext(providerNetworkKey, planNetwork)) {
    const planId = resolveDataDashBuiltinAirtelTigo(dataAmountMB)
    return planId ? { planId, catalog: 'AIRTEL-TIGO' } : null
  }
  if (isTelecelDataDashContext(providerNetworkKey, planNetwork)) {
    const planId = resolveDataDashBuiltinTelecel(dataAmountMB)
    return planId ? { planId, catalog: 'TELECEL' } : null
  }
  return null
}

async function callDataDash(input: DispatchInput): Promise<ProviderResult> {
  const { orderId, reference, network, phone, providerPlanId, dataAmountMB, planNetwork } = input

  const baseFromDb =
    network.baseUrl && /datadashgh/i.test(network.baseUrl) ? network.baseUrl : null
  const baseUrl = (
    process.env.DATADASHGH_BASE_URL ?? baseFromDb ?? 'https://datadashgh.com/agents/api/v1'
  ).replace(/\/$/, '')
  const apiKey = process.env.DATADASHGH_API_KEY ?? network.apiKey ?? ''

  const fromDb = (providerPlanId ?? '').trim()
  const fromMap = resolveDataDashPlanIdFromMap(network.providerNetworkKey, planNetwork ?? null, dataAmountMB)
  const builtin =
    !fromDb && !fromMap
      ? resolveDataDashBuiltin(network.providerNetworkKey, planNetwork ?? null, dataAmountMB)
      : null
  const fromBuiltin = builtin?.planId ?? null
  const planId = (fromDb || fromMap || fromBuiltin || '').trim()

  if (fromMap && !fromDb) {
    await logOrderEvent(orderId, 'DataDash plan_id resolved from DATADASHGH_PLAN_MAP', 'INFO', {
      mapKeyHint: `${network.providerNetworkKey ?? planNetwork ?? '?'}:${Math.round(dataAmountMB)}`,
    })
  } else if (builtin && !fromDb) {
    await logOrderEvent(orderId, `DataDash plan_id resolved from built-in ${builtin.catalog} catalog`, 'INFO', {
      dataAmountMB: Math.round(dataAmountMB),
      inferredGb: inferBundleGbFromMb(Math.round(dataAmountMB)),
    })
  }

  if (!planId) {
    await markManual(
      orderId,
      'No DataDash plan_id: set Provider plan id on the data plan, DATADASHGH_PLAN_MAP, or a supported built-in bundle (MTN / AIRTEL-TIGO / TELECEL)'
    )
    return {
      success: false,
      isManual: true,
      error:
        'DataDash plan_id missing — set Provider plan id, DATADASHGH_PLAN_MAP, or use a bundle size in the built-in MTN / AIRTEL-TIGO / TELECEL catalogs',
    }
  }

  if (!apiKey) {
    await markManual(orderId, 'DATADASHGH_API_KEY / network apiKey not configured')
    return { success: false, isManual: true, error: 'DataDash API key not configured' }
  }

  const endpoint = `${baseUrl}/orders`
  const requestBody = { plan_id: planId, recipient: phone }
  const bodyString = JSON.stringify(requestBody)

  const MAX_ATTEMPTS = 3
  const RETRY_DELAYS_MS = [0, 3_000, 6_000]
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt])
      await logOrderEvent(orderId, `Retrying DataDash API call (attempt ${attempt + 1}/${MAX_ATTEMPTS})`, 'WARNING', {
        attempt: attempt + 1,
        delayMs: RETRY_DELAYS_MS[attempt],
        lastError,
        planId,
      })
    }

    await logVtuApiCall(orderId, 'DataDashGH', endpoint, { planId, phone, attempt: attempt + 1 }, requestBody)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'text/plain',
        },
        body: bodyString,
        signal: controller.signal,
      })
      clearTimeout(timer)

      const json = await res.json().catch(() => null)

      if (res.ok && (!json || (json.success !== false && json.error == null))) {
        const providerRef =
          json?.data?.id ??
          json?.data?.reference ??
          json?.data?.order_id ??
          json?.id ??
          json?.reference ??
          reference

        await logVtuApiSuccess(orderId, 'DataDashGH', String(providerRef), {
          planId,
          responseStatus: json?.data?.status,
          attempt: attempt + 1,
        })

        await prisma.order.update({
          where: { id: orderId },
          data: { providerReference: String(providerRef), isManual: false },
        })
        await logStatusChange(orderId, 'PROCESSING', 'PROCESSING', {
          note: 'DataDash accepted order',
          providerReference: String(providerRef),
        })
        return { success: true, providerReference: String(providerRef) }
      }

      if (res.status >= 400 && res.status < 500) {
        const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`
        await logVtuApiFailure(orderId, 'DataDashGH', msg, { planId, attempt: attempt + 1 }, {
          httpStatus: res.status,
          httpStatusText: res.statusText,
          errorType: 'HTTP_ERROR',
          endpoint,
          requestBody,
          responseBody: json,
        })
        await markManual(orderId, `DataDash rejected request (${res.status}): ${msg}`)
        return { success: false, isManual: true, error: msg }
      }

      lastError = json?.message ?? json?.error ?? `HTTP ${res.status}`
      await logVtuApiFailure(orderId, 'DataDashGH', lastError, { planId, attempt: attempt + 1 }, {
        httpStatus: res.status,
        httpStatusText: res.statusText,
        errorType: 'HTTP_ERROR',
        endpoint,
        requestBody,
        responseBody: json,
      })
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError'
      lastError = isTimeout ? 'Request timed out after 30s' : (e.message ?? 'Network error')

      await logVtuApiFailure(orderId, 'DataDashGH', lastError, { planId, attempt: attempt + 1 }, {
        errorType: isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        errorName: e.name,
        errorMessage: e.message,
        timeoutMs: isTimeout ? 30_000 : undefined,
        endpoint,
        requestBody,
      })

      if (isTimeout) {
        await logOrderEvent(
          orderId,
          'DataDash API request timed out after sending.',
          'WARNING',
          { planId, timeoutMs: 30_000 }
        )
        return { success: false, error: lastError }
      }
    }
  }

  await logOrderEvent(
    orderId,
    `All ${MAX_ATTEMPTS} DataDash attempts failed. Order stays in PROCESSING.`,
    'ERROR',
    { lastError, planId, attempts: MAX_ATTEMPTS }
  )

  return { success: false, error: lastError }
}

// ─── Data Wave GH (WordPress custom REST) ────────────────────────────────────
// POST .../place-order — Authorization: Basic base64(username:password), JSON body:
// { network, recipient, package_size (GB), order_id }
//
// Stored providerNetworkKey: mtn | telecel | ishare | bigtime → API `network` uses
// AirtelTigo ISHARE / AirtelTigo BIGTIME for the AT variants.

async function callDataWave(input: DispatchInput): Promise<ProviderResult> {
  const { orderId, reference, network, phone, dataAmountMB } = input

  // Do not use Network.baseUrl unless it is clearly Data Wave — the DB default is DataHub's URL.
  const dataWaveDefault = 'https://dealers.datawavegh.com/wp-json/custom/v1'
  const fromEnv = process.env.DATAWAVEGH_BASE_URL?.trim()
  const fromDb = network.baseUrl?.trim()
  const dbIsDataWave = !!fromDb && /datawavegh\.com/i.test(fromDb)
  const baseUrl = (fromEnv || (dbIsDataWave ? fromDb : '') || dataWaveDefault).replace(/\/$/, '')
  const apiKey = process.env.DATAWAVEGH_API_KEY ?? network.apiKey ?? ''
  const networkKeyStored = (network.providerNetworkKey ?? '').trim()
  const networkForApi = resolveDataWaveApiNetwork(networkKeyStored)

  const mb = Math.round(dataAmountMB)
  const inferredGb = inferBundleGbFromMb(mb)
  const packageSize =
    inferredGb != null && inferredGb >= 1 ? inferredGb : Math.max(1, Math.round(mb / 1024))

  if (!networkKeyStored) {
    await markManual(orderId, 'providerNetworkKey not set on Network (Data Wave `network` value)')
    return { success: false, isManual: true, error: 'providerNetworkKey not configured' }
  }

  if (!apiKey) {
    await markManual(orderId, 'DATAWAVEGH_API_KEY / network apiKey not configured')
    return { success: false, isManual: true, error: 'Data Wave API key not configured' }
  }

  const authHeader = dataWaveBasicAuthorization(apiKey)
  const endpoint = `${baseUrl}/place-order`
  const requestBody = {
    network: networkForApi,
    recipient: phone,
    package_size: packageSize,
    order_id: reference,
  }

  const MAX_ATTEMPTS = 3
  const RETRY_DELAYS_MS = [0, 3_000, 6_000]
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt])
      await logOrderEvent(orderId, `Retrying Data Wave API call (attempt ${attempt + 1}/${MAX_ATTEMPTS})`, 'WARNING', {
        attempt: attempt + 1,
        delayMs: RETRY_DELAYS_MS[attempt],
        lastError,
        networkKey: networkKeyStored,
        networkForApi,
      })
    }

    await logVtuApiCall(orderId, 'DataWaveGH', endpoint, { networkKey: networkKeyStored, networkForApi, phone, packageSize, attempt: attempt + 1 }, requestBody)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      clearTimeout(timer)

      const json = await res.json().catch(() => null)

      if (res.ok && (json?.success !== false && json?.error == null)) {
        const providerRef =
          json?.order_id ??
          json?.data?.order_id ??
          json?.id ??
          json?.reference ??
          json?.data?.reference ??
          reference

        await logVtuApiSuccess(orderId, 'DataWaveGH', String(providerRef), {
          networkKey: networkKeyStored,
          networkForApi,
          packageSize,
          attempt: attempt + 1,
        })

        await prisma.order.update({
          where: { id: orderId },
          data: { providerReference: String(providerRef), isManual: false },
        })
        await logStatusChange(orderId, 'PROCESSING', 'PROCESSING', {
          note: 'Data Wave accepted order',
          providerReference: String(providerRef),
        })
        return { success: true, providerReference: String(providerRef) }
      }

      if (res.status >= 400 && res.status < 500) {
        const msg =
          json?.message ??
          json?.error ??
          (typeof json === 'string' ? json : null) ??
          `HTTP ${res.status}`
        await logVtuApiFailure(orderId, 'DataWaveGH', msg, { networkKey: networkKeyStored, networkForApi, attempt: attempt + 1 }, {
          httpStatus: res.status,
          httpStatusText: res.statusText,
          errorType: 'HTTP_ERROR',
          endpoint,
          requestBody,
          responseBody: json,
        })
        await markManual(orderId, `Data Wave rejected request (${res.status}): ${msg}`)
        return { success: false, isManual: true, error: msg }
      }

      lastError = json?.message ?? json?.error ?? `HTTP ${res.status}`
      await logVtuApiFailure(orderId, 'DataWaveGH', lastError, { networkKey: networkKeyStored, networkForApi, attempt: attempt + 1 }, {
        httpStatus: res.status,
        httpStatusText: res.statusText,
        errorType: 'HTTP_ERROR',
        endpoint,
        requestBody,
        responseBody: json,
      })
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError'
      lastError = isTimeout ? 'Request timed out after 30s' : (e.message ?? 'Network error')

      await logVtuApiFailure(orderId, 'DataWaveGH', lastError, { networkKey: networkKeyStored, networkForApi, attempt: attempt + 1 }, {
        errorType: isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        errorName: e.name,
        errorMessage: e.message,
        timeoutMs: isTimeout ? 30_000 : undefined,
        endpoint,
        requestBody,
      })

      if (isTimeout) {
        await logOrderEvent(
          orderId,
          'Data Wave API request timed out after sending.',
          'WARNING',
          { networkKey: networkKeyStored, networkForApi, timeoutMs: 30_000 }
        )
        return { success: false, error: lastError }
      }
    }
  }

  await logOrderEvent(
    orderId,
    `All ${MAX_ATTEMPTS} Data Wave attempts failed. Order stays in PROCESSING.`,
    'ERROR',
    { lastError, networkKey: networkKeyStored, networkForApi, attempts: MAX_ATTEMPTS }
  )

  return { success: false, error: lastError }
}

/** Maps admin keys ishare / bigtime (and mtn / telecel) to the strings the Data Wave API expects. */
function resolveDataWaveApiNetwork(providerNetworkKey: string): string {
  const raw = providerNetworkKey.trim()
  const compact = raw.toLowerCase().replace(/\s+/g, '')

  if (compact === 'ishare' || compact === 'atishare') return 'AirtelTigo ISHARE'
  if (compact === 'bigtime' || compact === 'atbigtime') return 'AirtelTigo BIGTIME'
  if (compact === 'mtn') return 'mtn'
  if (compact === 'telecel') return 'telecel'

  // Already API-shaped (e.g. legacy DB rows) or unknown — send as configured
  return raw
}

/**
 * Authorization: Basic base64_utf8('username:password').
 * WordPress application passwords are often copied with spaces; the REST API expects them removed.
 */
function dataWaveBasicAuthorization(usernamePassword: string): string {
  const raw = usernamePassword.trim()
  if (!raw) return 'Basic '
  const c = raw.indexOf(':')
  if (c <= 0 || c >= raw.length - 1) {
    return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`
  }
  const user = raw.slice(0, c).trim()
  const pass = raw.slice(c + 1).trim().replace(/\s+/g, '')
  if (!user || !pass) return 'Basic '
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`
}

// ─── Hubnet ──────────────────────────────────────────────────────────────────
// POST https://console.hubnet.app/live/api/context/business/transaction/{network}-new-transaction
// Headers: token: Bearer API_KEY, Content-Type: application/json
// Body: { phone, volume (MB as string), reference (6–25 chars) }
// Allowed network values: mtn | at | big-time

async function callHubnet(input: DispatchInput): Promise<ProviderResult> {
  const { orderId, reference, network, phone, dataAmountMB } = input

  const hubnetDefault = 'https://console.hubnet.app/live/api/context/business/transaction'
  const fromEnv = process.env.HUBNETGH_BASE_URL?.trim()
  const fromDb  = network.baseUrl?.trim()
  const dbIsHubnet = !!fromDb && /hubnet\.app/i.test(fromDb)
  const baseUrl = (fromEnv || (dbIsHubnet ? fromDb : '') || hubnetDefault).replace(/\/$/, '')
  const apiKey     = process.env.HUBNETGH_API_KEY ?? network.apiKey ?? ''
  const networkKey = (network.providerNetworkKey ?? '').trim()

  if (!networkKey) {
    await markManual(orderId, 'providerNetworkKey not set on Network (Hubnet network value: mtn | at | big-time)')
    return { success: false, isManual: true, error: 'providerNetworkKey not configured' }
  }

  if (!apiKey) {
    await markManual(orderId, 'HUBNETGH_API_KEY / network apiKey not configured')
    return { success: false, isManual: true, error: 'Hubnet API key not configured' }
  }

  // Hubnet reference: min 6, max 25 characters.
  const hubnetRef = reference.length > 25 ? reference.slice(0, 25) : reference

  // Webhook URL so Hubnet posts back the final order status automatically.
  const appUrl     = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const webhookUrl = appUrl ? `${appUrl}/api/webhooks/hubnet` : undefined

  const endpoint   = `${baseUrl}/${networkKey}-new-transaction`
  const requestBody: Record<string, string> = {
    phone,
    volume:    String(Math.round(dataAmountMB)),
    reference: hubnetRef,
    ...(webhookUrl && { webhook: webhookUrl }),
  }

  const MAX_ATTEMPTS    = 3
  const RETRY_DELAYS_MS = [0, 3_000, 6_000]
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt])
      await logOrderEvent(orderId, `Retrying Hubnet API call (attempt ${attempt + 1}/${MAX_ATTEMPTS})`, 'WARNING', {
        attempt:   attempt + 1,
        delayMs:   RETRY_DELAYS_MS[attempt],
        lastError,
        networkKey,
      })
    }

    await logVtuApiCall(orderId, 'HubnetGH', endpoint, { networkKey, phone, volume: requestBody.volume, attempt: attempt + 1 }, requestBody)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'token':        `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify(requestBody),
        signal: controller.signal,
      })
      clearTimeout(timer)

      const json = await res.json().catch(() => null)

      // ── Success ────────────────────────────────────────────────────────────
      // Hubnet returns { status: true, message: "0000", transaction_id: "TXN-..." }
      if (res.ok && json?.status === true && json?.message === '0000') {
        const providerRef =
          json?.transaction_id ??
          json?.payment_id     ??
          json?.reference      ??
          reference

        await logVtuApiSuccess(orderId, 'HubnetGH', String(providerRef), {
          networkKey,
          transactionId: json?.transaction_id,
          attempt:       attempt + 1,
        })

        await prisma.order.update({
          where: { id: orderId },
          data:  { providerReference: String(providerRef), isManual: false },
        })
        await logStatusChange(orderId, 'PROCESSING', 'PROCESSING', {
          note:              'Hubnet accepted order',
          providerReference: String(providerRef),
        })
        return { success: true, providerReference: String(providerRef) }
      }

      // ── 4xx: bad request / auth — no point retrying ───────────────────────
      if (res.status >= 400 && res.status < 500) {
        const msg = json?.reason ?? json?.message ?? json?.error ?? `HTTP ${res.status}`
        await logVtuApiFailure(orderId, 'HubnetGH', msg, { networkKey, attempt: attempt + 1 }, {
          httpStatus:     res.status,
          httpStatusText: res.statusText,
          errorType:      'HTTP_ERROR',
          endpoint,
          requestBody,
          responseBody:   json,
        })
        await markManual(orderId, `Hubnet rejected request (${res.status}): ${msg}`)
        return { success: false, isManual: true, error: msg }
      }

      // ── Application-level failure (status: false) — log and retry ─────────
      if (json?.status === false) {
        lastError = json?.reason ?? json?.message ?? 'Hubnet returned status:false'
        await logVtuApiFailure(orderId, 'HubnetGH', lastError, { networkKey, attempt: attempt + 1 }, {
          httpStatus:   res.status,
          errorType:    'APPLICATION_ERROR',
          endpoint,
          requestBody,
          responseBody: json,
        })
      } else {
        // ── 5xx transient ──────────────────────────────────────────────────
        lastError = json?.reason ?? json?.message ?? json?.error ?? `HTTP ${res.status}`
        await logVtuApiFailure(orderId, 'HubnetGH', lastError, { networkKey, attempt: attempt + 1 }, {
          httpStatus:     res.status,
          httpStatusText: res.statusText,
          errorType:      'HTTP_ERROR',
          endpoint,
          requestBody,
          responseBody:   json,
        })
      }
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError'
      lastError = isTimeout ? 'Request timed out after 30s' : (e.message ?? 'Network error')

      await logVtuApiFailure(orderId, 'HubnetGH', lastError, { networkKey, attempt: attempt + 1 }, {
        errorType:    isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        errorName:    e.name,
        errorMessage: e.message,
        timeoutMs:    isTimeout ? 30_000 : undefined,
        endpoint,
        requestBody,
      })

      if (isTimeout) {
        await logOrderEvent(
          orderId,
          'Hubnet API request timed out after sending.',
          'WARNING',
          { networkKey, timeoutMs: 30_000 }
        )
        return { success: false, error: lastError }
      }
    }
  }

  await logOrderEvent(
    orderId,
    `All ${MAX_ATTEMPTS} Hubnet attempts failed. Order stays in PROCESSING.`,
    'ERROR',
    { lastError, networkKey, attempts: MAX_ATTEMPTS }
  )

  return { success: false, error: lastError }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function markManual(orderId: string, reason: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data:  { status: 'PENDING', isManual: true },
  })
  await logManualProcessing(orderId, reason)
  await logStatusChange(orderId, 'PROCESSING', 'PENDING', { reason, source: 'provider-dispatch' })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
