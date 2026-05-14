import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [userCount, planCount, orderCounts, recentTx] = await Promise.all([
    prisma.user.count(),
    prisma.dataPlan.count({ where: { isActive: true } }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { order: { include: { plan: true, user: true } } },
    }),
  ])

  const counts: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  }
  for (const oc of orderCounts) {
    counts[oc.status] = oc._count._all
  }

  const recent = recentTx.map((p) => ({
    id: p.id,
    user: p.order?.user?.name || 'User',
    email: p.order?.user?.email || '',
    network: p.order?.plan?.network || '',
    phone: p.order?.phone,
    amount: Number(p.amount),
    status: p.status,
    date: p.createdAt.toISOString(),
  }))

  return NextResponse.json({
    success: true,
    data: {
      users: userCount,
      plans: planCount,
      orders: counts,
      recent,
    },
  })
}


