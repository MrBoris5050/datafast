import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderWebhooks } from '@/lib/webhooks'
import { logStatusChange } from '@/lib/order-logs'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Missing order id' }, { status: 400 })

    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id },
      include: { plan: true, user: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const oldStatus = order.status

    // Update order status
    const updated = await prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: status as any,
        },
      })

      // Update payment and transaction status based on new status
      if (status === 'COMPLETED') {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: 'COMPLETED' }
        })
        await tx.transaction.updateMany({
          where: { reference: order.reference },
          data: { status: 'COMPLETED' }
        })
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: 'FAILED' }
        })
        await tx.transaction.updateMany({
          where: { reference: order.reference },
          data: { status: 'FAILED' }
        })
      }

      return updatedOrder
    })

    // Log status change OUTSIDE transaction to avoid timeout issues
    if (oldStatus !== status) {
      await logStatusChange(id, oldStatus, status, {
        source: 'admin',
        updatedBy: session.user.id
      })
    }

    // Fetch updated order with relations for webhook
    const updatedOrderWithRelations = await prisma.order.findUnique({
      where: { id },
      include: { plan: true, user: true }
    })

    // Send SMS notification if order is completed
    if (status === 'COMPLETED' && oldStatus !== 'COMPLETED' && updatedOrderWithRelations) {
      const recipient = updatedOrderWithRelations.user?.phone || updatedOrderWithRelations.phone
      if (recipient) {
        try {
          // Import here to avoid circular dependencies
          const { sendSmsViaArkesel } = await import('@/lib/arkesel')
          const dataAmountGB = (updatedOrderWithRelations.plan.dataAmount / 1024).toFixed(1)
          const msg = `Your ${dataAmountGB} GB package has been successfully delivered to ${updatedOrderWithRelations.phone}. Thank you for your purchase!`
          const smsResult = await sendSmsViaArkesel({ to: recipient, message: msg })
          if (smsResult.ok) {
            console.log(`SMS sent successfully for order ${updatedOrderWithRelations.reference} to ${recipient}`)
          } else {
            console.error(`SMS send failed for order ${updatedOrderWithRelations.reference}:`, smsResult.error)
          }
        } catch (smsError) {
          console.error(`SMS send exception for order ${updatedOrderWithRelations.reference}:`, smsError)
        }
      } else {
        console.warn(`No phone number found for order ${updatedOrderWithRelations.reference} - user phone: ${updatedOrderWithRelations.user?.phone}, order phone: ${updatedOrderWithRelations.phone}`)
      }
    }

    // Send webhooks if status changed
    if (updatedOrderWithRelations && oldStatus !== status) {
      await sendOrderWebhooks(
        {
          ...updatedOrderWithRelations,
          providerReference: updatedOrderWithRelations.providerReference || null,
          plan: {
            id: updatedOrderWithRelations.plan.id,
            name: updatedOrderWithRelations.plan.name,
            dataAmount: updatedOrderWithRelations.plan.dataAmount,
            network: updatedOrderWithRelations.plan.network,
            validity: updatedOrderWithRelations.plan.validity ? String(updatedOrderWithRelations.plan.validity) : null
          }
        },
        status as any,
        oldStatus
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: updated,
      message: `Order status updated to ${status}`
    })
  } catch (error: any) {
    console.error('Error updating order status:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update order status' },
      { status: 500 }
    )
  }
}

