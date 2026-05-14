/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay in milliseconds */
  initialDelay: number
  /** Maximum delay in milliseconds */
  maxDelay: number
  /** Multiplier for exponential backoff */
  backoffMultiplier: number
  /** Function to determine if error is retryable */
  isRetryable?: (error: any) => boolean
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: any, delay: number) => void
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: () => true
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Check if this is the last attempt
      if (attempt > opts.maxRetries) {
        throw error
      }

      // Check if error is retryable
      if (opts.isRetryable && !opts.isRetryable(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      )

      // Add some jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay
      const actualDelay = Math.floor(delay + jitter)

      // Callback before retry
      if (opts.onRetry) {
        opts.onRetry(attempt, error, actualDelay)
      }

      // Wait before retry
      await sleep(actualDelay)
    }
  }

  throw lastError
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Default retryable error checker for HTTP/network errors
 */
export function isHttpRetryable(error: any): boolean {
  // Don't retry client errors (4xx) except for rate limiting (429)
  if (error?.httpStatus >= 400 && error?.httpStatus < 500 && error?.httpStatus !== 429) {
    return false
  }

  // Don't retry authentication errors
  if (error?.httpStatus === 401 || error?.httpStatus === 403) {
    return false
  }

  // Retry network errors, timeouts, and server errors
  const retryableErrors = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'AbortError'
  ]

  if (error?.code && retryableErrors.includes(error.code)) {
    return true
  }

  if (error?.name === 'AbortError') {
    return true
  }

  // Retry 5xx server errors
  if (error?.httpStatus >= 500) {
    return true
  }

  // Retry rate limiting
  if (error?.httpStatus === 429) {
    return true
  }

  // Default to retry for unknown errors
  return true
}

/**
 * Check if a VTU API result should be retried
 */
export function isVtuResultRetryable(result: { success: boolean; errorDetails?: any }): boolean {
  if (result.success) return false

  const errorDetails = result.errorDetails
  if (!errorDetails) return true // Retry unknown errors

  // Don't retry client errors
  if (errorDetails.httpStatus >= 400 && errorDetails.httpStatus < 500 && errorDetails.httpStatus !== 429) {
    return false
  }

  // Retry timeouts
  if (errorDetails.errorType === 'TIMEOUT') {
    return true
  }

  // Retry server errors
  if (errorDetails.httpStatus >= 500) {
    return true
  }

  // Retry network errors
  if (errorDetails.errorType === 'EXCEPTION') {
    return true
  }

  return false
}
