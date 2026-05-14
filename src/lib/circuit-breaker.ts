/**
 * Circuit Breaker implementation for VTU provider resilience
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time in ms before attempting to close circuit */
  resetTimeout: number
  /** Number of successful calls needed to close circuit from half-open */
  successThreshold: number
  /** Name for logging purposes */
  name: string
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailure: Date | null
  lastSuccess: Date | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  name: 'default'
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private successes = 0
  private lastFailure: Date | null = null
  private lastSuccess: Date | null = null
  private totalRequests = 0
  private totalFailures = 0
  private totalSuccesses = 0
  private options: CircuitBreakerOptions

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (this.lastFailure && Date.now() - this.lastFailure.getTime() > this.options.resetTimeout) {
        console.log(`[CircuitBreaker:${this.options.name}] Transitioning from OPEN to HALF_OPEN`)
        this.state = 'HALF_OPEN'
        this.successes = 0
      } else {
        const waitTime = this.lastFailure 
          ? Math.ceil((this.options.resetTimeout - (Date.now() - this.lastFailure.getTime())) / 1000)
          : this.options.resetTimeout / 1000
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN for ${this.options.name}. Service unavailable. Retry in ${waitTime}s.`,
          waitTime
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  /**
   * Check if request can proceed without executing
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true
    }
    
    // Check if enough time has passed to transition to HALF_OPEN
    if (this.lastFailure && Date.now() - this.lastFailure.getTime() > this.options.resetTimeout) {
      return true
    }
    
    return false
  }

  /**
   * Get current state and statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = 'CLOSED'
    this.failures = 0
    this.successes = 0
    console.log(`[CircuitBreaker:${this.options.name}] Reset to CLOSED state`)
  }

  private onSuccess(): void {
    this.lastSuccess = new Date()
    this.totalSuccesses++

    if (this.state === 'HALF_OPEN') {
      this.successes++
      console.log(`[CircuitBreaker:${this.options.name}] Success in HALF_OPEN state (${this.successes}/${this.options.successThreshold})`)
      
      if (this.successes >= this.options.successThreshold) {
        console.log(`[CircuitBreaker:${this.options.name}] Transitioning from HALF_OPEN to CLOSED`)
        this.state = 'CLOSED'
        this.failures = 0
        this.successes = 0
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failures = 0
    }
  }

  private onFailure(error: any): void {
    this.failures++
    this.totalFailures++
    this.lastFailure = new Date()

    console.log(`[CircuitBreaker:${this.options.name}] Failure recorded (${this.failures}/${this.options.failureThreshold})`, {
      error: error?.message || String(error),
      state: this.state
    })

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN opens the circuit again
      console.log(`[CircuitBreaker:${this.options.name}] Failure in HALF_OPEN, transitioning to OPEN`)
      this.state = 'OPEN'
      this.successes = 0
    } else if (this.failures >= this.options.failureThreshold) {
      console.log(`[CircuitBreaker:${this.options.name}] Failure threshold reached, transitioning to OPEN`)
      this.state = 'OPEN'
    }
  }
}

/**
 * Custom error for when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  public readonly retryAfter: number

  constructor(message: string, retryAfter: number) {
    super(message)
    this.name = 'CircuitBreakerOpenError'
    this.retryAfter = retryAfter
  }
}

// Singleton instances for different providers
const circuitBreakers: Map<string, CircuitBreaker> = new Map()

/**
 * Get or create a circuit breaker for a specific provider
 */
export function getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker({ ...options, name }))
  }
  return circuitBreakers.get(name)!
}

/**
 * Get circuit breaker for DataHubGH provider
 */
export function getDataHubCircuitBreaker(): CircuitBreaker {
  return getCircuitBreaker('DataHubGH', {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    successThreshold: 2
  })
}

/**
 * Check if VTU provider is available
 */
export function isVtuProviderAvailable(providerName: string = 'DataHubGH'): boolean {
  const breaker = circuitBreakers.get(providerName)
  if (!breaker) return true // No breaker means never failed
  return breaker.canExecute()
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {}
  circuitBreakers.forEach((breaker, name) => {
    stats[name] = breaker.getStats()
  })
  return stats
}

export { CircuitBreaker }
