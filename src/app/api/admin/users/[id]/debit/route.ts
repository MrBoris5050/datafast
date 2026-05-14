import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import { sendSmsViaArkesel } from '@/lib/arkesel'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const amountRaw = body?.amount
    const description: string = body?.description || 'Admin debit'

    const amount: number = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const reference = `admin_debit_${randomUUID()}`

    let newBalance: number | null = null
    let debitedUserPhone: string | null = null
    await prisma.$transaction(async (tx) => {
      // Ensure user exists
      const user = await tx.user.findUnique({ where: { id } })
      if (!user) throw new Error('User not found')
      debitedUserPhone = user.phone || null

      const currentBalance = Number(user.walletBalance)
      if (currentBalance < amount) {
        throw new Error('Insufficient wallet balance')
      }

      // Decrement wallet
      const updated = await tx.user.update({
        where: { id },
        data: { walletBalance: { decrement: amount } },
        select: { walletBalance: true },
      })
      newBalance = Number(updated.walletBalance)

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: id,
          type: 'DEBIT',
          amount,
          description,
          reference,
          status: 'COMPLETED',
        },
      })
    })

    // Attempt SMS notification (non-blocking failure)
    if (debitedUserPhone) {
      const formattedAmount = Number.isFinite(amount) ? (amount as number).toFixed(2) : String(amount)
      const formattedBalance = newBalance !== null ? Number(newBalance).toFixed(2) : null
      const msg = `GHS ${formattedAmount} has been debited from your datafast wallet. Ref: ${reference}${formattedBalance ? `. New balance: GHS ${formattedBalance}` : ''}`
      // Fire-and-forget; do not await to avoid slowing response, but here we await to surface errors in logs without failing request
      const sms = await sendSmsViaArkesel({ to: debitedUserPhone, message: msg })
      if (!sms.ok) {
        console.error('Arkesel SMS (debit) failed:', sms.error)
      }
    }

    return NextResponse.json({ success: true, reference })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    let code = 500
    if (message === 'User not found') code = 404
    if (message === 'Insufficient wallet balance') code = 400
    return NextResponse.json({ error: message }, { status: code })
  }
}

