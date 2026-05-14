import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })

    const data = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      planName: o.plan?.name ?? 'Plan',
      network: o.plan?.network ?? 'Unknown',
      dataAmount: o.plan?.dataAmount ?? 0,
      amount: Number(o.amount),
      status: o.status,
      phone: o.phone,
      reference: o.reference,
      createdAt: o.createdAt.toISOString(),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Orders list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


