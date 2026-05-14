import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { paystack, formatAmount, generateReference } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const { userId, amount } = await request.json()

    if (!userId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Enforce minimum topup amount of 5 GHS
    if (Number(amount) < 5) {
      return NextResponse.json({ error: 'Minimum topup amount is ₵5' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const reference = generateReference()

    // Record a pending transaction for top-up
    await prisma.transaction.create({
      data: {
        userId,
        type: 'TOPUP',
        amount,
        description: 'Wallet top-up',
        reference,
        status: 'PENDING',
      },
    })

    // Add 2% processing fee (customer pays it; wallet only gets base amount)
    const baseAmount = Number(amount)
    const feePercent = 0.02
    const chargeAmount = baseAmount * (1 + feePercent)

    // Get base URL from environment or request
    const baseUrl = process.env.NEXTAUTH_URL;
    const paymentData = {
      email: user.email,
      amount: formatAmount(Number(chargeAmount)),
      reference,
      callback_url: `${baseUrl}/dashboard/wallet`,
      metadata: {
        kind: 'WALLET_TOPUP',
        userId,
        reference,
        baseAmount,
        feePercent,
        chargeAmount,
      },
    }

    const paymentResponse = await paystack.initializePayment(paymentData)
    if (!paymentResponse.status) {
      return NextResponse.json({ error: paymentResponse.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: paymentResponse.data?.authorization_url,
        reference,
      },
    })
  } catch (error) {
    console.error('Wallet topup init error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


