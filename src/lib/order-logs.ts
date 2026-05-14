import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'

interface LogMetadata {
  [key: string]: any
}

/**
 * Log an event for an order
 * @param tx - Optional transaction client. If provided, logs within the transaction.
 */
export async function logOrderEvent(
  orderId: string,
  message: string,
  level: LogLevel = 'INFO',
  metadata?: LogMetadata,
  tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  try {
    const client = tx || prisma
    await client.orderLog.create({
      data: {
        orderId,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (error) {
    // Don't throw - logging failures shouldn't break order processing
    console.error(`[OrderLog] Failed to log event for order ${orderId}:`, error)
  }
}

/**
 * Log order creation
 */
export async function logOrderCreated(
  orderId: string,
  reference: string,
  metadata?: LogMetadata,
  tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Order created with reference: ${reference}`,
    'INFO',
    { reference, ...metadata },
    tx
  )
}

/**
 * Log status change
 * @param tx - Optional transaction client. If provided, logs within the transaction.
 */
export async function logStatusChange(
  orderId: string,
  oldStatus: string,
  newStatus: string,
  metadata?: LogMetadata,
  tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  const level = newStatus === 'COMPLETED' ? 'SUCCESS' : 
                newStatus === 'FAILED' ? 'ERROR' : 'INFO'
  
  await logOrderEvent(
    orderId,
    `Status changed from ${oldStatus} to ${newStatus}`,
    level,
    { oldStatus, newStatus, ...metadata },
    tx
  )
}

/**
 * Log VTU processing start
 */
export async function logVtuProcessingStart(
  orderId: string,
  network: string,
  metadata?: LogMetadata
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Starting VTU processing for network: ${network}`,
    'INFO',
    { network, ...metadata }
  )
}

/**
 * Log VTU API call
 */
export async function logVtuApiCall(
  orderId: string,
  provider: string,
  endpoint: string,
  metadata?: LogMetadata,
  requestBody?: any
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Sending request to ${provider} API: ${endpoint}`,
    'INFO',
    { 
      provider, 
      endpoint, 
      ...(requestBody && { requestBody }),
      ...metadata 
    }
  )
}

/**
 * Log VTU API success
 */
export async function logVtuApiSuccess(
  orderId: string,
  provider: string,
  providerReference: string,
  metadata?: LogMetadata
): Promise<void> {
  await logOrderEvent(
    orderId,
    `VTU API call successful. Provider reference: ${providerReference}`,
    'SUCCESS',
    { provider, providerReference, ...metadata }
  )
}

/**
 * Log VTU API failure
 */
export async function logVtuApiFailure(
  orderId: string,
  provider: string,
  error: string,
  metadata?: LogMetadata,
  errorDetails?: {
    httpStatus?: number
    httpStatusText?: string
    responseBody?: any
    errorType?: string
    endpoint?: string
    requestBody?: any
    errorName?: string
    errorMessage?: string
    stack?: string
    timeoutMs?: number
    parseError?: string
    provider?: string
  }
): Promise<void> {
  const fullMetadata = {
    provider,
    error,
    ...metadata,
    ...(errorDetails && {
      errorDetails: {
        httpStatus: errorDetails.httpStatus,
        httpStatusText: errorDetails.httpStatusText,
        errorType: errorDetails.errorType,
        endpoint: errorDetails.endpoint,
        // Include response body (truncated if too long)
        responseBody: errorDetails.responseBody 
          ? (typeof errorDetails.responseBody === 'string' 
              ? errorDetails.responseBody.substring(0, 2000)
              : JSON.stringify(errorDetails.responseBody).substring(0, 2000))
          : undefined,
        // Include request body for debugging
        requestBody: errorDetails.requestBody,
        // Additional error info
        ...(errorDetails.errorName && { errorName: errorDetails.errorName }),
        ...(errorDetails.errorMessage && { errorMessage: errorDetails.errorMessage }),
        ...(errorDetails.stack && { stack: errorDetails.stack.substring(0, 500) }),
        ...(errorDetails.timeoutMs && { timeoutMs: errorDetails.timeoutMs }),
        ...(errorDetails.parseError && { parseError: errorDetails.parseError })
      }
    })
  }

  let message = `VTU API call failed: ${error}`
  if (errorDetails?.httpStatus) {
    message += ` (HTTP ${errorDetails.httpStatus}${errorDetails.httpStatusText ? ` ${errorDetails.httpStatusText}` : ''})`
  }
  if (errorDetails?.errorType) {
    message += ` [${errorDetails.errorType}]`
  }

  await logOrderEvent(
    orderId,
    message,
    'ERROR',
    fullMetadata
  )
}

/**
 * Log manual processing
 */
export async function logManualProcessing(
  orderId: string,
  reason: string,
  metadata?: LogMetadata
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Order marked for manual processing: ${reason}`,
    'WARNING',
    { reason, ...metadata }
  )
}

/**
 * Log webhook received
 */
export async function logWebhookReceived(
  orderId: string,
  source: string,
  event: string,
  metadata?: LogMetadata
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Webhook received from ${source}: ${event}`,
    'INFO',
    { source, event, ...metadata }
  )
}

/**
 * Log payment processing
 */
export async function logPaymentProcessing(
  orderId: string,
  method: string,
  amount: number,
  metadata?: LogMetadata,
  tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  await logOrderEvent(
    orderId,
    `Processing payment via ${method}: ₵${amount.toFixed(2)}`,
    'INFO',
    { method, amount, ...metadata },
    tx
  )
}

/**
 * Get all logs for an order
 */
export async function getOrderLogs(orderId: string) {
  return prisma.orderLog.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  })
}

