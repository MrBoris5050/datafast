// DataHubGH provider client
// Docs: https://user.datahubgh.com/docs/api
// API Example: /api/external/data-purchase

import { prisma } from '@/lib/db'
import { logVtuApiCall, logVtuApiFailure, logVtuApiSuccess } from '@/lib/order-logs'
import { isVtuResultRetryable, sleep } from '@/lib/retry'
import { getDataHubCircuitBreaker, CircuitBreakerOpenError } from '@/lib/circuit-breaker'

export type DatahubPurchaseParams = {
	baseUrl: string
	apiKey: string
	// normalized fields
	network: string
	planName?: string
	amount: number
	phone: string
	reference: string
	// Data amount in MB/GB for capacity field
	dataAmountMB?: number
	// Optional order ID for logging
	orderId?: string
}

export type ProviderPurchaseResult = {
	success: boolean
	providerReference?: string
	message?: string
	status?: string
	// Error details for logging
	errorDetails?: {
		httpStatus?: number
		httpStatusText?: string
		responseBody?: any
		errorType?: string
		endpoint?: string
		requestBody?: any
		provider?: string
		retryAfter?: number
		timeoutMs?: number
		errorName?: string
		errorMessage?: string
		parseError?: string
		stack?: string
	}
}

// Map network names to DataHubGH network keys
function mapNetworkToDatahubKey(network: string): string {
    const key = String(network).trim().toUpperCase()
    // MTN mappings
    if (['MTN', 'MTN GH', 'MTN-GHANA'].includes(key)) return 'YELLO' // Based on example
    // Telecel (formerly Vodafone)
    if (['VODAFONE', 'VF', 'VODA', 'TELECEL'].includes(key)) return 'TELECEL'
    // AirtelTigo
    if (['AIRTELTIGO', 'AIRTELTIGO GH', 'AIRTELTIGO-GHANA', 'TIGO', 'AIRTEL', 'AT ISHARE', 'AT-ISHARE', 'ISHARE'].includes(key)) return 'AT_PREMIUM'
    // AT Bigtime (AirtelTigo Bigtime)
    if (['AT BIGTIME', 'AT-BIGTIME', 'BIGTIME', 'AT BIG TIME', 'BIG TIME'].includes(key)) return 'AT_BIGTIME'
    // Return uppercase version as fallback
    return key
}

// Convert data amount to capacity format (GB as string, e.g., "1" for 1GB)
function formatCapacity(dataAmountMB?: number, planName?: string): string {
	if (dataAmountMB) {
		// Convert MB to GB, round to nearest integer
		const gb = Math.round(dataAmountMB / 1024)
		return gb > 0 ? String(gb) : '1'
	}
	// Try to extract from plan name (e.g., "1GB" -> "1")
	if (planName) {
		const match = planName.match(/(\d+)\s*GB?/i)
		if (match) return match[1]
	}
	// Default to 1GB
	return '1'
}

/**
 * Internal function that makes the actual API call (without retry/circuit breaker)
 */
async function datahubPurchaseInternal(params: DatahubPurchaseParams): Promise<ProviderPurchaseResult> {
    const { baseUrl, apiKey, network, planName, amount, phone, reference, dataAmountMB, orderId } = params
	const base = baseUrl.replace(/\/$/, '')
	
	// Use the correct endpoint based on the API example
	const endpoint = `${base}/external/data-purchase`
	
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-API-Key': apiKey, 
	}
	
	// Map network to DataHubGH network key format
	const networkKey = mapNetworkToDatahubKey(network)
	
	// Format capacity (data amount in GB as string)
	const capacity = formatCapacity(dataAmountMB, planName)
	
	// Request body matching the API example
	const body: Record<string, any> = {
		networkKey,
		recipient: phone,
		capacity,
	}
	
	// Get order ID if not provided (by reference)
	let finalOrderId = orderId
	if (!finalOrderId) {
		const order = await prisma.order.findUnique({
			where: { reference },
			select: { id: true }
		})
		finalOrderId = order?.id
	}
	
	// Log API call attempt
	if (finalOrderId) {
		await logVtuApiCall(finalOrderId, 'DataHubGH', endpoint, {
			network,
			networkKey,
			phone,
			capacity
		}, body)
	}
	
	try {
		console.log('[DataHubGH] Purchase request:', { 
			endpoint, 
			networkKey, 
			recipient: phone, 
			capacity,
			reference,
			network,
			requestBody: body
		})
		
		// Add timeout to prevent hanging requests (reduced from 180s to 60s with retry)
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
		
		const res = await fetch(endpoint, { 
			method: 'POST', 
			headers, 
			body: JSON.stringify(body),
			signal: controller.signal
		})
		
		clearTimeout(timeoutId)
		
		const text = await res.text()
		console.log('[DataHubGH] Response received:', { 
			endpoint, 
			status: res.status, 
			statusText: res.statusText, 
			text: text.substring(0, 500),
			reference
		})
		
		let json: any = null
		try { 
			json = JSON.parse(text) 
		} catch (parseError) {
			console.error('[DataHubGH] Failed to parse JSON response:', {
				reference,
				error: parseError,
				responseText: text.substring(0, 200)
			})
			// Return error with parse failure details
			const errorDetails = {
				errorType: 'JSON_PARSE_ERROR' as const,
				endpoint,
				requestBody: body,
				responseBody: text,
				parseError: parseError instanceof Error ? parseError.message : String(parseError)
			}
			
			// Log parse error
			if (finalOrderId) {
				await logVtuApiFailure(
					finalOrderId,
					'DataHubGH',
					'Failed to parse API response',
					{ network },
					errorDetails
				)
			}
			
			return {
				success: false,
				message: 'Failed to parse API response',
				errorDetails
			}
		}
		
		if (!res.ok) {
			const errorMsg = json?.error || json?.message || json?.data?.message || text || `HTTP ${res.status}`
			console.error('[DataHubGH] Purchase failed:', { 
				endpoint, 
				status: res.status, 
				error: errorMsg,
				reference,
				network,
				responseBody: json || text.substring(0, 200)
			})
			
			const errorDetails = {
				httpStatus: res.status,
				httpStatusText: res.statusText,
				responseBody: json || text,
				errorType: 'HTTP_ERROR' as const,
				endpoint,
				requestBody: body
			}
			
			// Log failure
			if (finalOrderId) {
				await logVtuApiFailure(
					finalOrderId,
					'DataHubGH',
					errorMsg,
					{ network },
					errorDetails
				)
			}
			
			return { 
				success: false, 
				message: errorMsg,
				errorDetails
			}
		}
		
		// Handle success response matching the API example structure
		if (json?.success && json?.data) {
			const providerRef = json.data.reference || json.data.orderNumber || json.data.id || null
			console.log('[DataHubGH] Purchase success:', {
				reference,
				network,
				networkKey,
				providerReference: providerRef,
				status: json.data.status,
				responseStructure: 'json.success && json.data',
				fullResponse: JSON.stringify(json).substring(0, 500)
			})
			
			// Log success
			if (finalOrderId) {
				await logVtuApiSuccess(finalOrderId, 'DataHubGH', providerRef || reference, {
					network,
					networkKey,
					responseStatus: json.data.status,
					responseBody: json
				})
			}
			
			return {
				success: true,
				providerReference: providerRef || reference,
				status: json.data.status,
				message: json.data.message || 'Purchase initialized successfully',
			}
		}
		
		// Fallback for different response structure
		const fallbackProviderRef = json?.data?.reference || json?.data?.orderNumber || json?.data?.id || json?.reference || json?.orderNumber || json?.id || null
		console.log('[DataHubGH] Purchase success (fallback structure):', {
			reference,
			network,
			networkKey,
			providerReference: fallbackProviderRef,
			responseStructure: 'fallback',
			availableFields: {
				'json.data.reference': json?.data?.reference,
				'json.data.orderNumber': json?.data?.orderNumber,
				'json.data.id': json?.data?.id,
				'json.reference': json?.reference,
				'json.orderNumber': json?.orderNumber,
				'json.id': json?.id
			},
			fullResponse: JSON.stringify(json).substring(0, 500)
		})
		
		// Log success (fallback)
		if (finalOrderId) {
			await logVtuApiSuccess(finalOrderId, 'DataHubGH', fallbackProviderRef || reference, {
				network,
				networkKey,
				responseStatus: json?.data?.status || json?.status,
				responseBody: json
			})
		}
		
		return {
			success: true,
			providerReference: fallbackProviderRef || reference,
			status: json?.data?.status || json?.status,
			message: json?.message || 'Purchase initialized',
		}
	} catch (e: any) {
		console.error('[DataHubGH] Purchase exception:', {
			reference,
			network,
			error: e?.message || String(e),
			errorName: e?.name,
			stack: e?.stack?.substring(0, 500)
		})
		
		let errorDetails: any
		if (e.name === 'AbortError') {
			errorDetails = {
				errorType: 'TIMEOUT' as const,
				endpoint,
				requestBody: body,
				timeoutMs: 60000
			}
		} else {
			errorDetails = {
				errorType: 'EXCEPTION' as const,
				errorName: e?.name,
				errorMessage: e?.message || String(e),
				endpoint,
				requestBody: body,
				stack: e?.stack?.substring(0, 1000)
			}
		}
		
		// Log exception
		if (finalOrderId) {
			await logVtuApiFailure(
				finalOrderId,
				'DataHubGH',
				e.name === 'AbortError' 
					? 'Request timeout: VTU provider did not respond in time'
					: e?.message || 'Provider request failed',
				{ network },
				errorDetails
			)
		}
		
		if (e.name === 'AbortError') {
			return { 
				success: false, 
				message: 'Request timeout: VTU provider did not respond in time',
				errorDetails
			}
		}
		return { 
			success: false, 
			message: e?.message || 'Provider request failed',
			errorDetails
		}
	}
}

/**
 * Purchase data via DataHubGH with result-based retry and circuit breaker.
 *
 * datahubPurchaseInternal returns error objects instead of throwing them, so
 * the exception-based withRetry helper never fires. This wrapper implements
 * result-based retry so every retryable error is actually retried.
 */
export async function datahubPurchase(params: DatahubPurchaseParams): Promise<ProviderPurchaseResult> {
	const circuitBreaker = getDataHubCircuitBreaker()

	// Check circuit breaker first
	if (!circuitBreaker.canExecute()) {
		const stats = circuitBreaker.getStats()
		console.log('[DataHubGH] Circuit breaker is OPEN, failing fast', stats)
		return {
			success: false,
			message: 'VTU provider temporarily unavailable. Please try again in a few minutes.',
			errorDetails: {
				errorType: 'CIRCUIT_BREAKER_OPEN' as const,
				retryAfter: 60
			}
		}
	}

	const MAX_ATTEMPTS = 3
	const DELAYS_MS = [0, 3000, 6000] // attempt 1 = immediate, 2 = 3s, 3 = 6s
	let lastResult: ProviderPurchaseResult | null = null

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		if (attempt > 0) {
			const delay = DELAYS_MS[attempt]
			console.log(`[DataHubGH] Retrying purchase (attempt ${attempt + 1}/${MAX_ATTEMPTS}), waiting ${delay}ms`, {
				reference: params.reference,
				network: params.network,
				lastError: lastResult?.errorDetails?.errorType
			})
			await sleep(delay)

			// Re-check circuit breaker before each retry
			if (!circuitBreaker.canExecute()) {
				return {
					success: false,
					message: 'VTU provider temporarily unavailable after retry.',
					errorDetails: { errorType: 'CIRCUIT_BREAKER_OPEN' as const, retryAfter: 60 }
				}
			}
		}

		try {
			const result = await circuitBreaker.execute(() => datahubPurchaseInternal(params))

			if (result.success) {
				return result
			}

			// Non-retryable failures (4xx client errors, explicit manual flag): return immediately
			if (!isVtuResultRetryable(result)) {
				return result
			}

			lastResult = result
			// Loop continues to next attempt
		} catch (error: any) {
			if (error instanceof CircuitBreakerOpenError) {
				return {
					success: false,
					message: error.message,
					errorDetails: { errorType: 'CIRCUIT_BREAKER_OPEN' as const, retryAfter: error.retryAfter }
				}
			}

			// Unexpected thrown error — treat as last result and retry
			lastResult = {
				success: false,
				message: error?.message || 'Provider request failed',
				errorDetails: { errorType: 'EXCEPTION' as const, errorMessage: error?.message || String(error) }
			}
		}
	}

	return lastResult ?? {
		success: false,
		message: 'All retry attempts exhausted',
		errorDetails: { errorType: 'EXCEPTION' as const }
	}
}

export type DatahubStatusParams = {
	baseUrl: string
	apiKey: string
	providerReference: string
}

export type ProviderStatusResult = {
	success: boolean
	status?: string // 'pending', 'processing', 'completed', 'failed'
	message?: string
	/** True when the status endpoint returned a non-API response (HTML, 404, etc.).
	 *  Callers should NOT mark the order manual in this case — leave in PROCESSING
	 *  for the webhook to resolve. */
	unavailable?: boolean
}

export async function datahubCheckStatus(params: DatahubStatusParams): Promise<ProviderStatusResult> {
	const { baseUrl, apiKey, providerReference } = params
	const base = baseUrl.replace(/\/$/, '')
	
	// Status endpoint - adjust based on DataHubGH API documentation
	const endpoint = `${base}/external/transaction-status`
	
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-API-Key': apiKey,
	}
	
	const body: Record<string, any> = {
		reference: providerReference,
	}
	
	try {
		console.log('DataHubGH status check request:', { endpoint, reference: providerReference })
		
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout for status checks
		
		const res = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: controller.signal
		})
		
		clearTimeout(timeoutId)
		
		const text = await res.text()
		console.log('DataHubGH status response:', { endpoint, status: res.status, text: text.substring(0, 200) })

		// Detect HTML responses — means the endpoint doesn't exist or returned a web page.
		// This is NOT a provider failure; return unavailable so callers leave the order
		// in PROCESSING rather than marking it manual.
		const isHtml = text.trimStart().startsWith('<!') || text.trimStart().toLowerCase().startsWith('<html')
		if (isHtml) {
			console.warn('DataHubGH status endpoint returned HTML (endpoint unavailable):', { endpoint, status: res.status })
			return { success: false, unavailable: true, message: 'Status endpoint unavailable — waiting for webhook' }
		}

		let json: any = null
		try {
			json = JSON.parse(text)
		} catch {
			console.error('Failed to parse status JSON response:', { endpoint, responsePreview: text.substring(0, 200) })
			return { success: false, unavailable: true, message: 'Status endpoint returned unexpected response' }
		}

		if (!res.ok) {
			const errorMsg = json?.error || json?.message || json?.data?.message || `HTTP ${res.status}`
			console.error('DataHubGH status check failed:', { endpoint, status: res.status, error: errorMsg })
			return { success: false, message: errorMsg }
		}
		
		// Parse status from response
		// Adjust based on actual DataHubGH API response structure
		const status = json?.data?.status || json?.status || json?.data?.transactionStatus
		const normalizedStatus = normalizeStatus(status)
		
		return {
			success: true,
			status: normalizedStatus,
			message: json?.message || json?.data?.message || 'Status retrieved',
		}
	} catch (e: any) {
		console.error('DataHubGH status check exception:', e)
		if (e.name === 'AbortError') {
			return { success: false, message: 'Status check timeout' }
		}
		return { success: false, message: e?.message || 'Status check failed' }
	}
}

// Normalize status values from DataHubGH to our internal status
function normalizeStatus(status: string | undefined): string {
	if (!status) return 'pending'
	
	const normalized = String(status).toLowerCase().trim()
	
	// Map common status values
	if (['completed', 'success', 'successful', 'delivered'].includes(normalized)) {
		return 'completed'
	}
	if (['failed', 'failure', 'error', 'rejected'].includes(normalized)) {
		return 'failed'
	}
	if (['processing', 'in-progress', 'pending', 'queued'].includes(normalized)) {
		return 'processing'
	}
	
	return normalized
}
