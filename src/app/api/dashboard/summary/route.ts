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

    const userId = session.user.id

    const [totalOrders, totals, recentOrders, wallet] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { userId, status: 'COMPLETED' },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { plan: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true, name: true } }),
    ])

    const totalSpent = Number(totals._sum.amount ?? 0)

    const formattedRecent = recentOrders.map((o) => ({
      id: o.id,
      plan: o.plan?.name ?? 'Plan',
      amount: Number(o.amount),
      status: o.status.toLowerCase(),
      date: o.createdAt.toISOString(),
      reference: o.reference,
      orderNumber: o.orderNumber,
      network: o.plan?.network ?? 'Unknown',
      phone: o.phone,
      dataAmount: o.plan?.dataAmount ?? 0,
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalSpent,
        activeDataPlans: 0,
        thisMonthOrders: 0,
        walletBalance: Number(wallet?.walletBalance ?? 0),
        recentOrders: formattedRecent,
        name: wallet?.name ?? null,
      },
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


