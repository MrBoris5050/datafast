import { prisma } from '@/lib/db'
import crypto from 'crypto'

type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface OrderWithRelations {
  id: string
  reference: string
  status: OrderStatus
  amount: any
  phone: string
  providerReference: string | null
  userId: string
  createdAt: Date
  plan: {
    id: string
    name: string
    dataAmount: number
    network: string
    validity: string | null
  }
}

/**
 * Sends webhooks to all active subscriptions for a user when order status changes
 * @param order - The order with relations (plan, user)
 * @param newStatus - The new status of the order
 * @param oldStatus - The previous status (optional, to avoid sending if unchanged)
 */
export async function sendOrderWebhooks(
  order: OrderWithRelations,
  newStatus: OrderStatus,
  oldStatus?: OrderStatus
): Promise<void> {
  // Don't send if status hasn't changed
  if (oldStatus && oldStatus === newStatus) {
    return
  }

  try {
    // Fetch active webhook subscriptions for the order owner
    const webhookSubscriptions = await prisma.webhookSubscription.findMany({
      where: {
        userId: order.userId,
        active: true
      }
    })

    if (webhookSubscriptions.length === 0) {
      return // No webhooks to send
    }

    // Map status to webhook event
    let webhookEvent = 'order.processing'
    if (newStatus === 'COMPLETED') {
      webhookEvent = 'order.completed'
    } else if (newStatus === 'FAILED' || newStatus === 'CANCELLED') {
      webhookEvent = 'order.failed'
    } else if (newStatus === 'PROCESSING') {
      webhookEvent = 'order.processing'
    }

    // Send webhook to each subscription
    const webhookPromises = webhookSubscriptions.map(async (subscription) => {
      const webhookPayload = {
        event: webhookEvent,
        data: {
          id: order.id,
          reference: order.reference,
          status: newStatus,
          amount: Number(order.amount),
          phone: order.phone,
          plan: {
            id: order.plan.id,
            name: order.plan.name,
            dataAmount: order.plan.dataAmount,
            dataAmountGB: (order.plan.dataAmount / 1024).toFixed(2),
            network: order.plan.network,
            validity: order.plan.validity
          },
          createdAt: order.createdAt,
          updatedAt: new Date()
        },
        timestamp: new Date().toISOString()
      }

      // Create signature
      const payloadString = JSON.stringify(webhookPayload)
      const hmac = crypto.createHmac('sha256', subscription.secret)
      const signature = hmac.update(payloadString).digest('hex')

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': webhookEvent
          },
          body: payloadString,
          signal: controller.signal
        })

        if (!response.ok) {
          console.error(`Webhook delivery failed for ${subscription.url}: ${response.status} ${response.statusText}`)
        } else {
          console.log(`Webhook delivered successfully to ${subscription.url} for order ${order.reference}`)
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error(`Webhook timeout for ${subscription.url} (order ${order.reference})`)
        } else {
          console.error(`Error sending webhook to ${subscription.url}:`, error.message)
        }
      } finally {
        clearTimeout(timeoutId)
      }
    })

    // Send webhooks in parallel (don't await to avoid blocking)
    Promise.all(webhookPromises).catch(err => {
      console.error('Error sending developer webhooks:', err)
    })
  } catch (error: any) {
    console.error('Error fetching webhook subscriptions:', error)
  }
}

