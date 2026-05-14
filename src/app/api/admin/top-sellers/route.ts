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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const roleFilter = searchParams.get('role') || 'ALL'

    // Parse dates or use defaults (last 7 days)
    const now = new Date()
    const defaultStart = new Date()
    defaultStart.setDate(now.getDate() - 7)
    
    const start = startDate ? new Date(startDate) : defaultStart
    const end = endDate ? new Date(endDate) : now
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999)
    start.setHours(0, 0, 0, 0)

    // Build role filter condition
    const roleCondition = roleFilter !== 'ALL' ? { role: roleFilter as any } : {}

    // Get top sellers by completed orders
    const topSellers = await prisma.order.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      _count: { id: true },
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: 'COMPLETED',
        user: roleCondition
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      },
      take: limit
    })

    // Get user details for top sellers
    const userIds = topSellers.map(s => s.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        walletBalance: true,
        createdAt: true
      }
    })

    // Get additional stats for each user
    const userStats = await Promise.all(
      userIds.map(async (userId) => {
        const [completedOrders, failedOrders, averageOrderValue] = await Promise.all([
          prisma.order.count({
            where: {
              userId,
              status: 'COMPLETED',
              createdAt: { gte: start, lte: end }
            }
          }),
          prisma.order.count({
            where: {
              userId,
              status: 'FAILED',
              createdAt: { gte: start, lte: end }
            }
          }),
          prisma.order.aggregate({
            _avg: { amount: true },
            where: {
              userId,
              status: 'COMPLETED',
              createdAt: { gte: start, lte: end }
            }
          })
        ])

        return {
          userId,
          completedOrders,
          failedOrders,
          averageOrderValue: Number(averageOrderValue._avg.amount || 0)
        }
      })
    )

    // Combine all data
    const sellersData = topSellers.map((seller, index) => {
      const user = users.find(u => u.id === seller.userId)
      const stats = userStats.find(s => s.userId === seller.userId)
      
      return {
        rank: index + 1,
        userId: seller.userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        phone: user?.phone || '',
        role: user?.role || 'CUSTOMER',
        walletBalance: Number(user?.walletBalance || 0),
        memberSince: user?.createdAt?.toISOString() || '',
        totalSales: Number(seller._sum.amount || 0),
        orderCount: seller._count.id,
        completedOrders: stats?.completedOrders || 0,
        failedOrders: stats?.failedOrders || 0,
        averageOrderValue: stats?.averageOrderValue || 0,
        successRate: stats ? 
          ((stats.completedOrders / (stats.completedOrders + stats.failedOrders)) * 100 || 0).toFixed(1) : 
          '0'
      }
    })

    // Calculate summary stats
    const totalSalesInPeriod = sellersData.reduce((sum, s) => sum + s.totalSales, 0)
    const totalOrdersInPeriod = sellersData.reduce((sum, s) => sum + s.orderCount, 0)
    const uniqueSellers = sellersData.length

    // Get top network by sales
    const networkSales = await prisma.order.groupBy({
      by: ['planId'],
      _sum: { amount: true },
      _count: { id: true },
      where: {
        createdAt: { gte: start, lte: end },
        status: 'COMPLETED'
      },
      orderBy: {
        _sum: { amount: 'desc' }
      },
      take: 5
    })

    const planIds = networkSales.map(n => n.planId)
    const plans = await prisma.dataPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, network: true, name: true }
    })

    const topNetworks = networkSales.map(n => {
      const plan = plans.find(p => p.id === n.planId)
      return {
        network: plan?.network || 'Unknown',
        planName: plan?.name || 'Unknown',
        sales: Number(n._sum.amount || 0),
        orders: n._count.id
      }
    })

    // Aggregate by network
    const networkAggregated: Record<string, { sales: number; orders: number }> = {}
    topNetworks.forEach(n => {
      if (!networkAggregated[n.network]) {
        networkAggregated[n.network] = { sales: 0, orders: 0 }
      }
      networkAggregated[n.network].sales += n.sales
      networkAggregated[n.network].orders += n.orders
    })

    const networkBreakdown = Object.entries(networkAggregated)
      .map(([network, data]) => ({
        network,
        sales: data.sales,
        orders: data.orders
      }))
      .sort((a, b) => b.sales - a.sales)

    return NextResponse.json({
      success: true,
      data: {
        sellers: sellersData,
        summary: {
          totalSalesInPeriod,
          totalOrdersInPeriod,
          uniqueSellers,
          averagePerSeller: uniqueSellers > 0 ? totalSalesInPeriod / uniqueSellers : 0
        },
        networkBreakdown,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching top sellers:', error)
    return NextResponse.json({ error: 'Failed to fetch top sellers' }, { status: 500 })
  }
}
