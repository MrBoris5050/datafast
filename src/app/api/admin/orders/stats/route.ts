import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  // Build date filter for orders
  const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {}
  if (startDate || endDate) {
    dateFilter.createdAt = {}
    if (startDate) {
      dateFilter.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      dateFilter.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
    }
  }

  // Build date filter for transactions
  const txDateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {}
  if (startDate || endDate) {
    txDateFilter.createdAt = {}
    if (startDate) {
      txDateFilter.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      txDateFilter.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
    }
  }

  const [orderCounts, totalTx, vtuTx, agentOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { _all: true },
    }),
    prisma.transaction.count({ where: txDateFilter }),
    prisma.transaction.count({ where: { ...txDateFilter, type: 'PURCHASE' } }),
    prisma.order.count({ where: { ...dateFilter, user: { role: 'AGENT' } } }),
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

  return NextResponse.json({
    success: true,
    data: {
      pending: counts.PENDING,
      processing: counts.PROCESSING,
      successful: counts.COMPLETED,
      canceled: counts.CANCELLED,
      refunded: counts.FAILED,
      totalTransactions: totalTx,
      vtuTransactions: vtuTx,
      voucherTransactions: 0,
      agentOrders,
    },
  })
}


