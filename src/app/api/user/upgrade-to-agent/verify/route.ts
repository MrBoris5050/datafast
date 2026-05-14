import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { paystack } from '@/lib/paystack'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reference } = await req.json()
    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    const tx = await prisma.transaction.findUnique({ where: { reference } })

    if (!tx || tx.userId !== session.user.id) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // If webhook already handled it, return success immediately
    if (tx.status === 'COMPLETED') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      return NextResponse.json({
        success: true,
        message: 'Upgrade already processed',
        newRole: user?.role,
        alreadyProcessed: true
      })
    }

    if (tx.status === 'FAILED') {
      return NextResponse.json({ error: 'Payment was not successful' }, { status: 400 })
    }

    // Verify with Paystack
    const verify = await paystack.verifyPayment(reference)
    if (!verify.status) {
      return NextResponse.json({ error: verify.message }, { status: 400 })
    }

    const paymentData = verify.data as any
    if (!paymentData || paymentData.status !== 'success') {
      return NextResponse.json({ error: 'Payment was not successful' }, { status: 400 })
    }

    // Validate amount (base price + 2% fee)
    const paystackAmountGHS = (paymentData.amount || 0) / 100
    const expectedCharge = Number(tx.amount) * 1.02
    if (Math.abs(paystackAmountGHS - expectedCharge) > 0.05) {
      console.error('Amount mismatch on agent upgrade verify:', {
        reference,
        paystackAmountGHS,
        expectedCharge
      })
      return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 })
    }

    // Check user is still a CUSTOMER (guard against double upgrade)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    if (currentUser?.role !== 'CUSTOMER') {
      // Already upgraded — just mark tx complete if it isn't
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED' }
      })
      return NextResponse.json({
        success: true,
        message: 'Already upgraded',
        newRole: currentUser?.role,
        alreadyProcessed: true
      })
    }

    // Atomically upgrade role and mark transaction complete
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { role: 'AGENT' }
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED' }
      })
    ])

    return NextResponse.json({
      success: true,
      message: 'Congratulations! Your account has been upgraded to Agent.',
      newRole: 'AGENT'
    })
  } catch (error) {
    console.error('Agent upgrade verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
