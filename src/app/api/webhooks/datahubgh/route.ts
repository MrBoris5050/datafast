import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { sendOrderWebhooks } from '@/lib/webhooks'
import { notifyOrderCompleted, notifyOrderFailed } from '@/lib/notifications'

// Verify webhook signature if DataHubGH provides one
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    const digest = hmac.update(payload).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify webhook signature if provided
    const signature = request.headers.get('x-signature') || request.headers.get('x-datahubgh-signature')
    const webhookSecret = process.env.DATAHUBGH_WEBHOOK_SECRET
    
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Extract data from DataHubGH webhook structure
    const event = body.event // e.g., "order.completed", "order.failed", "order.status.changed"
    const providerReference = body.data?.reference
    const orderNumber = body.data?.orderNumber // New field for order status changed events
    const status = body.data?.status // e.g., "SUCCESSFUL", "FAILED"
    const oldStatus = body.data?.oldStatus
    const message = body.data?.statusDescription || body.data?.message
    const network = body.data?.network
    const recipient = body.data?.recipient || body.data?.phoneNumber
    const dataAmount = body.data?.dataAmount
    const amountPaid = body.data?.amountPaid
    const orderDate = body.data?.orderDate
    const timestamp = body.timestamp

    if (!providerReference && !orderNumber) {
      console.error('No reference or orderNumber found in webhook payload:', body)
      return NextResponse.json(
        { error: 'Missing reference or orderNumber' },
        { status: 400 }
      )
    }

    console.log('DataHubGH webhook received:', { 
      event, 
      providerReference, 
      orderNumber,
      status, 
      oldStatus,
      network, 
      recipient,
      dataAmount,
      amountPaid,
      timestamp
    })

    // Find order by multiple methods:
    // 1. By provider reference
    // 2. By order reference (if providerReference is actually an order reference)
    // 3. By order number (for order.status.changed events)
    let order = null

    if (providerReference) {
      order = await prisma.order.findFirst({
        where: { providerReference },
        include: { plan: true, user: true }
      })

      // Fallback: try to find by order reference if providerReference doesn't match
      if (!order) {
        order = await prisma.order.findUnique({
          where: { reference: providerReference },
          include: { plan: true, user: true }
        })
      }
    }

    // Try finding by order number if still not found
    if (!order && orderNumber) {
      order = await prisma.order.findUnique({
        where: { orderNumber: Number(orderNumber) },
        include: { plan: true, user: true }
      })
    }

    // Additional fallback: Try finding by phone number + network + recent timestamp
    // This helps with orders where providerReference might not match (e.g., AT ishare)
    let foundViaFallback = false
    if (!order && recipient && network) {
      // Normalize network name for matching (handle variations like "AT ISHARE", "AT-ISHARE", "AT_PREMIUM")
      const normalizedNetwork = String(network).trim().toUpperCase()
      const networkVariations = [
        normalizedNetwork,
        normalizedNetwork.replace(/-/g, ' '),
        normalizedNetwork.replace(/_/g, ' '),
        normalizedNetwork.replace(/\s+/g, '-'),
        normalizedNetwork.replace(/\s+/g, '_')
      ]
      
      // Also handle AT ishare specific mappings
      if (normalizedNetwork.includes('AT_PREMIUM') || normalizedNetwork.includes('AT-PREMIUM')) {
        networkVariations.push('AT ISHARE', 'AT-ISHARE', 'AT_ISHARE')
      }
      if (normalizedNetwork.includes('ISHARE')) {
        networkVariations.push('AT ISHARE', 'AT-ISHARE', 'AT_ISHARE', 'AT_PREMIUM', 'AT-PREMIUM')
      }

      // Normalize phone number (remove country code if present)
      const normalizedPhone = recipient.replace(/^\+?233/, '0').replace(/^233/, '0')
      
      console.log('Attempting fallback order lookup by phone + network:', {
        recipient,
        normalizedPhone,
        network,
        networkVariations
      })

      // Find most recent PROCESSING or PENDING order matching phone and network
      order = await prisma.order.findFirst({
        where: {
          phone: {
            in: [recipient, normalizedPhone, `233${normalizedPhone.slice(1)}`, `+233${normalizedPhone.slice(1)}`]
          },
          status: {
            in: ['PROCESSING', 'PENDING']
          },
          plan: {
            network: {
              in: networkVariations
            }
          },
          // Only look for orders from the last 24 hours to avoid false matches
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        include: { plan: true, user: true },
        orderBy: { createdAt: 'desc' }
      })

      if (order) {
        foundViaFallback = true
        console.log('Order found via fallback lookup (phone + network):', {
          orderReference: order.reference,
          orderProviderReference: order.providerReference,
          webhookProviderReference: providerReference,
          phone: order.phone,
          network: order.plan.network
        })
      }
    }

    if (!order) {
      const searchKey = providerReference || `orderNumber: ${orderNumber}` || `phone: ${recipient}, network: ${network}`
      console.warn('Order not found for:', searchKey, {
        providerReference,
        orderNumber,
        recipient,
        network,
        event,
        status
      })
      // Return 200 to acknowledge webhook even if order not found
      return NextResponse.json({ received: true, message: 'Order not found' })
    }

    // Determine status based on event and status field
    let newStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' = 'PROCESSING'
    
    // Handle order.status.changed event (new event type)
    if (event === 'order.status.changed') {
      const normalizedStatus = String(status || '').toUpperCase().trim()
      // Handle all status values from DataHub
      if (normalizedStatus === 'SUCCESSFUL' || normalizedStatus === 'COMPLETED') {
        newStatus = 'COMPLETED'
      } else if (normalizedStatus === 'PROCESSING') {
        newStatus = 'PROCESSING'
      } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED') {
        newStatus = 'FAILED'
      } else if (normalizedStatus === 'PENDING') {
        newStatus = 'PENDING'
      } else {
        // Unknown status - log and keep current status
        console.log(`Order ${order.reference} status changed event received with unknown status (${normalizedStatus}), keeping current status`)
        newStatus = order.status // Keep current status
      }
    } else if (event === 'order.completed') {
      // Check the status field to confirm
      const normalizedStatus = String(status || '').toUpperCase().trim()
      if (normalizedStatus === 'SUCCESSFUL') {
        newStatus = 'COMPLETED'
      } else {
        // Even if event is completed, if status is not SUCCESSFUL, mark as failed
        newStatus = 'FAILED'
      }
    } else if (event === 'order.failed' || event === 'order.cancelled') {
      newStatus = 'FAILED'
    } else if (status) {
      // Fallback to status field if event is not clear
      const normalizedStatus = String(status).toUpperCase().trim()
      if (normalizedStatus === 'SUCCESSFUL' || normalizedStatus === 'COMPLETED') {
        newStatus = 'COMPLETED'
      } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED') {
        newStatus = 'FAILED'
      } else if (normalizedStatus === 'PENDING' || normalizedStatus === 'PROCESSING') {
        newStatus = 'PROCESSING'
      }
    }

    // Log webhook received
    const { logWebhookReceived, logStatusChange, logOrderEvent } = await import('@/lib/order-logs')
    await logWebhookReceived(order.id, 'DataHubGH', event, {
      providerReference,
      status,
      orderNumber
    })

    // Only update if status changed or if we need to update providerReference
    const needsProviderReferenceUpdate = (foundViaFallback || providerReference) && providerReference && !order.providerReference
    // Also update if order was marked manual due to timeout but webhook confirms success or processing
    const wasManualDueToTimeout = order.isManual && (newStatus === 'COMPLETED' || newStatus === 'PROCESSING') && !order.providerReference
    
    if (newStatus !== order.status || needsProviderReferenceUpdate || wasManualDueToTimeout) {
      await prisma.$transaction(async (tx) => {
        // Update order status and providerReference if needed
        const updateData: any = { 
          status: newStatus,
          updatedAt: new Date()
        }
        
        // If webhook confirms success/processing and order was marked manual (likely due to timeout),
        // clear the manual flag since DataHub actually processed it
        if (wasManualDueToTimeout) {
          updateData.isManual = false
          console.log(`Clearing manual flag for order ${order.reference} - webhook confirms DataHub ${newStatus === 'COMPLETED' ? 'completed' : 'is processing'} it`)
        }
        
        // Update providerReference if webhook provides one and we don't have it
        if (needsProviderReferenceUpdate || (wasManualDueToTimeout && providerReference)) {
          updateData.providerReference = providerReference
          console.log(`Updating providerReference for order ${order.reference}: ${providerReference}`)
        }
        
        await tx.order.update({
          where: { id: order.id },
          data: updateData
        })

        // Update payment and transaction status based on new status
        if (newStatus === 'COMPLETED') {
          await tx.payment.updateMany({
            where: { orderId: order.id },
            data: { status: 'COMPLETED' }
          })
          await tx.transaction.updateMany({
            where: { reference: order.reference },
            data: { status: 'COMPLETED' }
          })
        } else if (newStatus === 'PROCESSING') {
          // Keep payment and transaction as PENDING when status is PROCESSING
          // They will be updated to COMPLETED when order completes
        } else if (newStatus === 'FAILED') {
          await tx.payment.updateMany({
            where: { orderId: order.id },
            data: { status: 'FAILED' }
          })
          await tx.transaction.updateMany({
            where: { reference: order.reference },
            data: { status: 'FAILED' }
          })

          // Refund wallet if not already refunded
          const existingRefund = await tx.transaction.findFirst({
            where: {
              reference: { startsWith: `${order.reference}_refund` },
              type: 'REFUND'
            }
          })

          if (!existingRefund) {
            await tx.user.update({
              where: { id: order.userId },
              data: { walletBalance: { increment: order.amount } }
            })
            await tx.transaction.create({
              data: {
                userId: order.userId,
                type: 'REFUND',
                amount: order.amount as unknown as any,
                description: `Refund for failed order: ${order.plan.name}${message ? ` - ${message}` : ''}`,
                reference: `${order.reference}_refund`,
                status: 'COMPLETED'
              }
            })
          }
        }
      })

      // Log status change OUTSIDE transaction to avoid timeout issues
      await logStatusChange(order.id, order.status, newStatus, {
        source: 'webhook',
        event,
        providerReference,
        wasManualCleared: wasManualDueToTimeout
      })
      
      // Log if manual flag was cleared due to webhook confirmation
      if (wasManualDueToTimeout) {
        await logOrderEvent(
          order.id,
          `Manual flag cleared - webhook confirms DataHub ${newStatus === 'COMPLETED' ? 'completed' : 'is processing'} order despite API timeout`,
          newStatus === 'COMPLETED' ? 'SUCCESS' : 'INFO',
          {
            source: 'webhook',
            event,
            providerReference,
            newStatus,
            note: 'Original API call timed out, but DataHub processed the order and sent webhook confirmation'
          }
        )
      }
      
      // Log when order status is updated to PROCESSING via webhook
      if (newStatus === 'PROCESSING' && order.status !== 'PROCESSING') {
        await logOrderEvent(
          order.id,
          'Order status updated to PROCESSING via DataHub webhook',
          'INFO',
          {
            source: 'webhook',
            event,
            providerReference,
            oldStatus: order.status,
            note: 'DataHub confirmed order is being processed'
          }
        )
      }

      console.log(`Order ${order.reference} status updated from ${order.status} to ${newStatus} via webhook`, {
        event,
        providerReference,
        network,
        recipient,
        dataAmount
      })

      // Send notifications outside transaction to avoid blocking
      // Use the notification system for multi-channel delivery (SMS, email, in-app)
      if (newStatus === 'COMPLETED' && order.status !== 'COMPLETED') {
        // Send completion notification via all channels
        notifyOrderCompleted(order.userId, {
          reference: order.reference,
          planName: order.plan.name,
          phone: order.phone,
          amount: Number(order.amount)
        }).then(result => {
          console.log(`[Webhook] Notification results for completed order ${order.reference}:`, result)
        }).catch(error => {
          console.error(`[Webhook] Notification error for order ${order.reference}:`, error)
        })
      } else if (newStatus === 'FAILED' && order.status !== 'FAILED') {
        // Send failure notification via all channels
        notifyOrderFailed(order.userId, {
          reference: order.reference,
          planName: order.plan.name,
          phone: order.phone,
          amount: Number(order.amount),
          reason: message
        }).then(result => {
          console.log(`[Webhook] Notification results for failed order ${order.reference}:`, result)
        }).catch(error => {
          console.error(`[Webhook] Notification error for order ${order.reference}:`, error)
        })
      }

      // Fetch updated order with relations for webhook
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { plan: true }
      })

      if (updatedOrder) {
        // Send webhooks to user's webhook URLs
        await sendOrderWebhooks(
          {
            ...updatedOrder,
            providerReference: updatedOrder.providerReference || null,
            plan: {
              id: updatedOrder.plan.id,
              name: updatedOrder.plan.name,
              dataAmount: updatedOrder.plan.dataAmount,
              network: updatedOrder.plan.network,
              validity: updatedOrder.plan.validity ? String(updatedOrder.plan.validity) : null
            }
          },
          newStatus,
          order.status
        )
      }
    } else {
      console.log(`Order ${order.reference} webhook received but status unchanged (current: ${order.status}, webhook: ${newStatus})`)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed',
      orderReference: order.reference,
      status: newStatus,
      event
    })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    // Return 200 to prevent webhook retries for processing errors
    return NextResponse.json(
      { error: error?.message || 'Webhook processing failed' },
      { status: 200 }
    )
  }
}

// Allow GET for webhook verification/health checks
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'DataHubGH webhook endpoint is active'
  })
}

