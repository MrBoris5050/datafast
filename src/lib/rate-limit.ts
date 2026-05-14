/**
 * Rate limiting utility for API endpoints
 * Tracks requests per user with sliding window approach
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// Key: userId, Value: RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval to remove expired entries
const CLEANUP_INTERVAL = 60000 // 1 minute
setInterval(() => {
  const now = Date.now()
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(userId)
    }
  }
}, CLEANUP_INTERVAL)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  limit: number
}

/**
 * Check if a request should be rate limited
 * @param userId - The user ID to check rate limit for
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with allowed status and metadata
 */
export function checkRateLimit(
  userId: string,
  limit: number = 150,
  windowMs: number = 60000 // 1 minute
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  // If no entry exists or window has expired, create new entry
  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs
    rateLimitStore.set(userId, {
      count: 1,
      resetTime
    })
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime,
      limit
    }
  }

  // Entry exists and window is still active
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      limit
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
    limit
  }
}

/**
 * Get rate limit headers for HTTP response
 * @param result - RateLimitResult from checkRateLimit
 * @returns Object with rate limit headers
 */
export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}


