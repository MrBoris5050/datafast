/**
 * Utility to check and handle orders stuck in PROCESSING state
 */

import { prisma } from '@/lib/db'
import { datahubCheckStatus } from './providers/datahubgh'
import { logOrderEvent, logStatusChange } from './order-logs'

export interface StuckOrdersConfig {
  /** Time in ms after which an order is considered stuck (default: 1 hour) */
  stuckThreshold: number
  /** Maximum number of orders to process at once */
  batchSize: number
  /** Whether to auto-mark as manual if provider status check fails */
  autoMarkManual: boolean
}

const DEFAULT_CONFIG: StuckOrdersConfig = {
  stuckThreshold: 60 * 60 * 1000, // 1 hour
  batchSize: 50,
  autoMarkManual: true
}

export interface StuckOrderResult {
  orderId: string
  reference: string
  action: 'completed' | 'failed' | 'manual' | 'unchanged' | 'error'
  message: string
}

/**
 * Check for orders stuck in PROCESSING state and attempt to resolve them
 */
export async function checkStuckOrders(
  config: Partial<StuckOrdersConfig> = {}
): Promise<StuckOrderResult[]> {
  const opts = { ...DEFAULT_CONFIG, ...config }
  const results: StuckOrderResult[] = []

  try {
    // Find orders stuck in PROCESSING with a provider reference
    const stuckOrders = await prisma.order.findMany({
      where: {
        status: 'PROCESSING',
        providerReference: { not: null },
        updatedAt: { lt: new Date(Date.now() - opts.stuckThreshold) }
      },
      include: { 
        plan: true,
        user: { select: { id: true, email: true, phone: true } }
      },
      take: opts.batchSize,
      orderBy: { updatedAt: 'asc' }
    })

    console.log(`[StuckOrders] Found ${stuckOrders.length} stuck orders to check`)

    for (const order of stuckOrders) {
      try {
        // Get VTU source for this network
        const networkSetting = await prisma.networkApiSetting.findUnique({
          where: { networkName: order.plan.network },
          include: { vtuSource: true }
        })

        if (!networkSetting?.vtuSource) {
          // No VTU source configured, mark as manual
          if (opts.autoMarkManual) {
            await markOrderAsManual(order.id, 'No VTU source configured for network')
            results.push({
              orderId: order.id,
              reference: order.reference,
              action: 'manual',
              message: 'No VTU source configured for network'
            })
          }
          continue
        }

        // Check status with provider
        const statusResult = await datahubCheckStatus({
          baseUrl: networkSetting.vtuSource.baseUrl,
          apiKey: networkSetting.vtuSource.apiKey,
          providerReference: order.providerReference!
        })

        if (!statusResult.success) {
          // If the status endpoint is unavailable (returned HTML, 404, etc.)
          // leave the order in PROCESSING — the webhook will resolve it.
          // Never mark manual for an unreachable endpoint.
          if (statusResult.unavailable) {
            console.log(`[StuckOrders] Status endpoint unavailable for order ${order.reference} — leaving in PROCESSING for webhook`)
            results.push({
              orderId:   order.id,
              reference: order.reference,
              action:    'unchanged',
              message:   'Status endpoint unavailable — waiting for webhook confirmation'
            })
            continue
          }

          console.log(`[StuckOrders] Status check failed for order ${order.reference}:`, statusResult.message)

          if (opts.autoMarkManual) {
            await markOrderAsManual(order.id, `Status check failed: ${statusResult.message}`)
            results.push({
              orderId:   order.id,
              reference: order.reference,
              action:    'manual',
              message:   `Status check failed: ${statusResult.message}`
            })
          } else {
            results.push({
              orderId:   order.id,
              reference: order.reference,
              action:    'unchanged',
              message:   `Status check failed: ${statusResult.message}`
            })
          }
          continue
        }

        // Update order based on provider status
        const providerStatus = statusResult.status?.toLowerCase()

        if (providerStatus === 'completed' || providerStatus === 'success' || providerStatus === 'successful') {
          await completeOrder(order.id, order.reference)
          results.push({
            orderId: order.id,
            reference: order.reference,
            action: 'completed',
            message: 'Provider confirmed order completed'
          })
        } else if (providerStatus === 'failed' || providerStatus === 'failure' || providerStatus === 'cancelled') {
          await failOrder(order.id, order.reference, order.userId, Number(order.amount), order.plan.name)
          results.push({
            orderId: order.id,
            reference: order.reference,
            action: 'failed',
            message: 'Provider confirmed order failed'
          })
        } else if (providerStatus === 'processing' || providerStatus === 'pending') {
          // Still processing, just log it
          await logOrderEvent(
            order.id,
            `Status check: Provider reports order still ${providerStatus}`,
            'INFO',
            { providerStatus, checkedAt: new Date().toISOString() }
          )
          results.push({
            orderId: order.id,
            reference: order.reference,
            action: 'unchanged',
            message: `Provider reports status: ${providerStatus}`
          })
        } else {
          // Unknown status
          results.push({
            orderId: order.id,
            reference: order.reference,
            action: 'unchanged',
            message: `Unknown provider status: ${providerStatus}`
          })
        }
      } catch (error: any) {
        console.error(`[StuckOrders] Error processing order ${order.reference}:`, error)
        results.push({
          orderId: order.id,
          reference: order.reference,
          action: 'error',
          message: error?.message || 'Unknown error'
        })
      }
    }

    return results
  } catch (error: any) {
    console.error('[StuckOrders] Error checking stuck orders:', error)
    throw error
  }
}

/**
 * Get count of stuck orders for monitoring
 */
export async function getStuckOrdersCount(thresholdMs: number = 60 * 60 * 1000): Promise<number> {
  return prisma.order.count({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: new Date(Date.now() - thresholdMs) }
    }
  })
}

/**
 * Get stuck orders without processing them (for admin viewing)
 */
export async function getStuckOrdersList(
  thresholdMs: number = 60 * 60 * 1000,
  limit: number = 100
) {
  return prisma.order.findMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: new Date(Date.now() - thresholdMs) }
    },
    include: {
      plan: { select: { name: true, network: true } },
      user: { select: { name: true, email: true } }
    },
    take: limit,
    orderBy: { updatedAt: 'asc' }
  })
}

// Helper functions

async function markOrderAsManual(orderId: string, reason: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { 
      isManual: true,
      status: 'PENDING'
    }
  })
  
  await logStatusChange(orderId, 'PROCESSING', 'PENDING', {
    reason: `Marked manual: ${reason}`,
    source: 'stuck-orders-checker'
  })
}

async function completeOrder(orderId: string, reference: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' }
    })
    
    await tx.payment.updateMany({
      where: { orderId },
      data: { status: 'COMPLETED' }
    })
    
    await tx.transaction.updateMany({
      where: { reference },
      data: { status: 'COMPLETED' }
    })
  })
  
  await logStatusChange(orderId, 'PROCESSING', 'COMPLETED', {
    source: 'stuck-orders-checker',
    reason: 'Provider status check confirmed completion'
  })
}

async function failOrder(
  orderId: string, 
  reference: string, 
  userId: string, 
  amount: number, 
  planName: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'FAILED' }
    })
    
    await tx.payment.updateMany({
      where: { orderId },
      data: { status: 'FAILED' }
    })
    
    await tx.transaction.updateMany({
      where: { reference },
      data: { status: 'FAILED' }
    })
    
    // Check if refund already exists
    const existingRefund = await tx.transaction.findFirst({
      where: {
        reference: { startsWith: `${reference}_refund` },
        type: 'REFUND'
      }
    })
    
    if (!existingRefund) {
      // Refund wallet
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } }
      })
      
      await tx.transaction.create({
        data: {
          userId,
          type: 'REFUND',
          amount: amount as unknown as any,
          description: `Refund for failed order: ${planName}`,
          reference: `${reference}_refund`,
          status: 'COMPLETED'
        }
      })
    }
  })
  
  await logStatusChange(orderId, 'PROCESSING', 'FAILED', {
    source: 'stuck-orders-checker',
    reason: 'Provider status check confirmed failure',
    refunded: true
  })
}
