import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'

    // Calculate date ranges
    const now = new Date()
    const currentPeriodStart = new Date()
    const previousPeriodStart = new Date()

    switch (range) {
      case '1d':
        currentPeriodStart.setDate(now.getDate() - 1)
        previousPeriodStart.setDate(now.getDate() - 2)
        break
      case '30d':
        currentPeriodStart.setDate(now.getDate() - 30)
        previousPeriodStart.setDate(now.getDate() - 60)
        break
      case '90d':
        currentPeriodStart.setDate(now.getDate() - 90)
        previousPeriodStart.setDate(now.getDate() - 180)
        break
      default: // 7d
        currentPeriodStart.setDate(now.getDate() - 7)
        previousPeriodStart.setDate(now.getDate() - 14)
    }

    // Get total counts
    const [totalUsers, totalOrders, totalRevenue, activeDataPlans] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { amount: true }
      }),
      prisma.dataPlan.count({ where: { isActive: true } })
    ])

    // Get today's stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const [newUsersToday, ordersToday, revenueToday] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: todayStart } }
      })
    ])

    // Get current period stats
    const [currentPeriodUsers, currentPeriodOrders, currentPeriodRevenue] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: currentPeriodStart } } }),
      prisma.order.count({ where: { createdAt: { gte: currentPeriodStart } } }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: currentPeriodStart } }
      })
    ])

    // Get previous period stats
    const [previousPeriodUsers, previousPeriodOrders, previousPeriodRevenue] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
          }
        }
      }),
      prisma.order.count({
        where: {
          createdAt: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
          }
        }
      }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
          }
        }
      })
    ])

    // Calculate growth percentages
    const userGrowth = previousPeriodUsers > 0
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : 0
    const orderGrowth = previousPeriodOrders > 0
      ? ((currentPeriodOrders - previousPeriodOrders) / previousPeriodOrders) * 100
      : 0
    const revenueGrowth = previousPeriodRevenue._sum.amount && Number(previousPeriodRevenue._sum.amount) > 0
      ? ((Number(currentPeriodRevenue._sum.amount || 0) - Number(previousPeriodRevenue._sum.amount)) / Number(previousPeriodRevenue._sum.amount)) * 100
      : 0

    // Get network performance
    const ordersWithPlans = await prisma.order.findMany({
      where: { createdAt: { gte: currentPeriodStart } },
      include: {
        plan: true
      }
    })

    const networkStats: Record<string, { orders: number; revenue: number }> = {}
    
    ordersWithPlans.forEach(order => {
      const network = order.plan.network || 'Unknown'
      if (!networkStats[network]) {
        networkStats[network] = { orders: 0, revenue: 0 }
      }
      networkStats[network].orders++
      networkStats[network].revenue += Number(order.amount)
    })

    const topNetworks = Object.entries(networkStats)
      .map(([network, stats]) => ({
        network,
        orders: stats.orders,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Get recent activity
    const [recentOrders, recentUsers] = await Promise.all([
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          user: true
        }
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
      })
    ])

    const recentActivity = [
      ...recentOrders.slice(0, 5).map(order => ({
        id: order.id,
        type: 'order',
        description: `New order completed: ${order.plan.name} for ₵${Number(order.amount).toFixed(2)}`,
        timestamp: order.createdAt.toISOString()
      })),
      ...recentUsers.slice(0, 3).map(user => ({
        id: user.id,
        type: 'user',
        description: `New user registered: ${user.name || user.email}`,
        timestamp: user.createdAt.toISOString()
      }))
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return NextResponse.json({
      totalUsers,
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      activeDataPlans,
      newUsersToday,
      ordersToday,
      revenueToday: Number(revenueToday._sum.amount || 0),
      userGrowth: Number(userGrowth.toFixed(1)),
      orderGrowth: Number(orderGrowth.toFixed(1)),
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      topNetworks,
      recentActivity
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
