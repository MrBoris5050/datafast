import { NextRequest, NextResponse } from 'next/server'
import { paystack, formatAmount, generateReference } from '@/lib/paystack'
import { prisma } from '@/lib/db'
import { getPlanPriceForRole } from '@/lib/pricing'
import { getNextOrderNumber } from '@/lib/order-number'

export async function POST(request: NextRequest) {
  try {
    const { planId, phoneNumber, userId } = await request.json()

    // Validate required fields
    if (!planId || !phoneNumber || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get user and plan details
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.dataPlan.findUnique({ where: { id: planId } })
    ])

    if (!user || !plan) {
      return NextResponse.json(
        { error: 'User or plan not found' },
        { status: 404 }
      )
    }

    // Get next order number and create order
    const orderAmount = getPlanPriceForRole(plan as any, user.role)
    const orderNumber = await getNextOrderNumber()
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        planId,
        amount: orderAmount as unknown as any,
        phone: phoneNumber,
        reference: generateReference(),
        status: 'PENDING'
      }
    })

    // Get base URL from environment or request
    const baseUrl = process.env.NEXTAUTH_URL || 
                    process.env.NEXT_PUBLIC_APP_URL || 
                    `${request.nextUrl.protocol}//${request.nextUrl.host}`

    // Initialize payment with Paystack
    const paymentData = {
      email: user.email,
      amount: formatAmount(Number(orderAmount)),
      reference: order.reference,
      callback_url: `${baseUrl}/payment/callback`,
      metadata: {
        orderId: order.id,
        planId: plan.id,
        phoneNumber: phoneNumber
      }
    }

    const paymentResponse = await paystack.initializePayment(paymentData)

    if (!paymentResponse.status) {
      return NextResponse.json(
        { error: paymentResponse.message },
        { status: 400 }
      )
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        amount: orderAmount as unknown as any,
        reference: order.reference,
        method: 'paystack',
        status: 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: paymentResponse.data?.authorization_url,
        reference: order.reference
      }
    })

  } catch (error) {
    console.error('Payment initialization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
