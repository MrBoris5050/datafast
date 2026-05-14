import { NextRequest, NextResponse } from 'next/server'
import { paystack } from '@/lib/paystack'
import { prisma } from '@/lib/db'
import { sendOrderWebhooks } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference is required' },
        { status: 400 }
      )
    }

    // Verify payment with Paystack
    const verificationResponse = await paystack.verifyPayment(reference)

    if (!verificationResponse.status) {
      return NextResponse.json(
        { error: verificationResponse.message },
        { status: 400 }
      )
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { reference },
      include: { plan: true, user: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const oldStatus = order.status

    // Update order and payment status
    await prisma.$transaction(async (tx) => {
      // Update order
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' }
      })

      // Update payment
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { 
          status: 'COMPLETED',
          gateway: reference
        }
      })

      // Create data usage record
      await tx.dataUsage.create({
        data: {
          userId: order.userId,
          phone: order.phone,
          dataUsed: order.plan.dataAmount,
          planName: order.plan.name,
          network: order.plan.network
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: order.userId,
          type: 'PURCHASE',
          amount: order.amount,
          description: `Data purchase: ${order.plan.name}`,
          reference: order.reference,
          status: 'COMPLETED'
        }
      })
    })

    // Fetch updated order with relations for webhook
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { plan: true }
    })

    // Send webhooks if status changed
    if (updatedOrder && oldStatus !== 'COMPLETED') {
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
        'COMPLETED',
        oldStatus
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        orderId: order.id,
        status: 'completed'
      }
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
