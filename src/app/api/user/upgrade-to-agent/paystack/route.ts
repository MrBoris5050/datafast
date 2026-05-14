import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { paystack, formatAmount } from '@/lib/paystack'

const SETTING_KEY = 'agent_upgrade_price'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true }
    })

    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Your account is already at Agent level or higher' },
        { status: 400 }
      )
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY }
    })

    if (!setting) {
      return NextResponse.json(
        { error: 'Agent upgrade is not currently available' },
        { status: 400 }
      )
    }

    const basePrice = parseFloat(setting.value)
    // Add 2% processing fee — user pays it; same pattern as wallet topup
    const chargeAmount = basePrice * 1.02
    const reference = `DLT_UPGRADE_${Date.now()}`
    const baseUrl = process.env.NEXTAUTH_URL;

    // Create a pending DEBIT transaction to track this payment
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEBIT',
        amount: basePrice,
        description: 'Agent role upgrade fee (Paystack)',
        reference,
        status: 'PENDING'
      }
    })

    const paymentResponse = await paystack.initializePayment({
      email: user.email,
      amount: formatAmount(chargeAmount),
      reference,
      callback_url: `${baseUrl}/dashboard/upgrade-to-agent?reference=${reference}`,
      metadata: {
        kind: 'AGENT_UPGRADE',
        userId: user.id,
        reference,
        basePrice,
        chargeAmount
      }
    })

    if (!paymentResponse.status) {
      // Roll back the pending transaction on Paystack failure
      await prisma.transaction.deleteMany({ where: { reference } })
      return NextResponse.json({ error: paymentResponse.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: paymentResponse.data?.authorization_url,
      reference
    })
  } catch (error) {
    console.error('Agent upgrade Paystack init error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
