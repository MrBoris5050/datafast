import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderWebhooks } from '@/lib/webhooks'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderIds, status } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Order IDs array is required' }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Find all orders
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { plan: true, user: true }
    })

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 })
    }

    // Store old statuses for webhook comparison
    const oldStatuses = new Map(orders.map(o => [o.id, o.status]))

    // Update all orders in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update all orders
      const updatedOrders = await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status: status as any,
          // If switching to pending, mark as manual
          ...(status === 'PENDING' && { isManual: true }),
        },
      })

      // Get all order references for updating payments and transactions
      const orderRefs = orders.map(o => o.reference)

      // Update payment and transaction status based on new status
      if (status === 'COMPLETED') {
        await tx.payment.updateMany({
          where: { orderId: { in: orderIds } },
          data: { status: 'COMPLETED' }
        })
        await tx.transaction.updateMany({
          where: { reference: { in: orderRefs } },
          data: { status: 'COMPLETED' }
        })
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        await tx.payment.updateMany({
          where: { orderId: { in: orderIds } },
          data: { status: 'FAILED' }
        })
        await tx.transaction.updateMany({
          where: { reference: { in: orderRefs } },
          data: { status: 'FAILED' }
        })
      }

      return updatedOrders
    })

    // Fetch updated orders with relations for webhooks
    const updatedOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { plan: true, user: true }
    })

    // Send SMS notifications for orders that are completed
    if (status === 'COMPLETED') {
      const { sendSmsViaArkesel } = await import('@/lib/arkesel')
      const smsPromises = updatedOrders
        .filter(o => oldStatuses.get(o.id) !== 'COMPLETED')
        .map(async (order) => {
          const recipient = order.user?.phone || order.phone
          if (recipient) {
            try {
              const dataAmountGB = (order.plan.dataAmount / 1024).toFixed(1)
              const msg = `Your ${dataAmountGB} GB package has been successfully delivered to ${order.phone}. Thank you for your purchase!`
              const smsResult = await sendSmsViaArkesel({ to: recipient, message: msg })
              if (smsResult.ok) {
                console.log(`SMS sent successfully for order ${order.reference} to ${recipient}`)
              } else {
                console.error(`SMS send failed for order ${order.reference}:`, smsResult.error)
              }
            } catch (smsError) {
              console.error(`SMS send exception for order ${order.reference}:`, smsError)
            }
          } else {
            console.warn(`No phone number found for order ${order.reference} - user phone: ${order.user?.phone}, order phone: ${order.phone}`)
          }
        })
      
      // Send SMS in parallel (don't await to avoid blocking response)
      Promise.all(smsPromises).catch(err => {
        console.error('Error sending bulk update SMS:', err)
      })
    }

    // Send webhooks for orders that changed status
    const webhookPromises = updatedOrders
      .filter(o => oldStatuses.get(o.id) !== status)
      .map(order => 
        sendOrderWebhooks(
          {
            ...order,
            providerReference: order.providerReference || null,
            plan: {
              id: order.plan.id,
              name: order.plan.name,
              dataAmount: order.plan.dataAmount,
              network: order.plan.network,
              validity: (order.plan.validity ? String(order.plan.validity) : null) as string | null
            }
          },
          status as any,
          oldStatuses.get(order.id) as any
        )
      )

    // Send webhooks in parallel (don't await to avoid blocking)
    Promise.all(webhookPromises).catch(err => {
      console.error('Error sending bulk update webhooks:', err)
    })

    return NextResponse.json({ 
      success: true, 
      data: { count: result.count },
      message: `Successfully updated ${result.count} order(s) to ${status}`
    })
  } catch (error: any) {
    console.error('Error bulk updating order status:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to bulk update order status' },
      { status: 500 }
    )
  }
}


