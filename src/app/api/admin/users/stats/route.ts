import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [totalOrders, walletSum, agentOrders] = await Promise.all([
    prisma.order.count(),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    prisma.order.count({ where: { user: { role: 'AGENT' } } }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      totalTransfers: totalOrders,
      totalWalletBalance: Number(walletSum._sum.walletBalance ?? 0),
      agentTransfers: agentOrders,
    },
  })
}


