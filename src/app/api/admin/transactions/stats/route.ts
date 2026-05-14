import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [txCounts, totalTx, vtuTx, agentOrders] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { type: 'PURCHASE' } }),
    prisma.order.count({ where: { user: { role: 'AGENT' } } }),
  ])

  const counts: Record<string, number> = {
    PENDING: 0,
    COMPLETED: 0,
    FAILED: 0,
  }
  for (const tc of txCounts) {
    counts[tc.status] = tc._count._all
  }

  return NextResponse.json({
    success: true,
    data: {
      pending: counts.PENDING,
      processing: 0,
      successful: counts.COMPLETED,
      canceled: 0,
      refunded: counts.FAILED,
      totalTransactions: totalTx,
      vtuTransactions: vtuTx,
      voucherTransactions: 0,
      agentOrders,
    },
  })
}


