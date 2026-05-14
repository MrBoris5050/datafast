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
    const reportType = searchParams.get('type') || 'summary'

    // Calculate date ranges
    const now = new Date()
    const periodStart = new Date()

    let periodLabel = ''
    switch (range) {
      case '1d':
        periodStart.setDate(now.getDate() - 1)
        periodLabel = 'Last 24 hours'
        break
      case '30d':
        periodStart.setDate(now.getDate() - 30)
        periodLabel = 'Last 30 days'
        break
      case '90d':
        periodStart.setDate(now.getDate() - 90)
        periodLabel = 'Last 90 days'
        break
      default: // 7d
        periodStart.setDate(now.getDate() - 7)
        periodLabel = 'Last 7 days'
    }

    // Get summary statistics
    const [totalUsers, totalOrders, totalRevenue] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.order.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: periodStart } }
      })
    ])

    const revenue = Number(totalRevenue._sum.amount || 0)
    const averageOrderValue = totalOrders > 0 ? revenue / totalOrders : 0

    // Get top customers
    const ordersWithUsers = await prisma.order.findMany({
      where: { createdAt: { gte: periodStart } },
      include: {
        user: true
      }
    })

    const customerStats: Record<string, { name: string; email: string; totalSpent: number; orderCount: number }> = {}
    
    ordersWithUsers.forEach(order => {
      const userId = order.userId
      if (!customerStats[userId]) {
        customerStats[userId] = {
          name: order.user.name || 'N/A',
          email: order.user.email,
          totalSpent: 0,
          orderCount: 0
        }
      }
      customerStats[userId].totalSpent += Number(order.amount)
      customerStats[userId].orderCount++
    })

    const topCustomers = Object.entries(customerStats)
      .map(([id, stats]) => ({
        id,
        ...stats
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)

    // Get top plans
    const ordersWithPlans = await prisma.order.findMany({
      where: { createdAt: { gte: periodStart } },
      include: {
        plan: true
      }
    })

    const planStats: Record<string, { name: string; network: string; orderCount: number; revenue: number }> = {}
    
    ordersWithPlans.forEach(order => {
      const planId = order.planId
      if (!planStats[planId]) {
        planStats[planId] = {
          name: order.plan.name,
          network: order.plan.network || 'Unknown',
          orderCount: 0,
          revenue: 0
        }
      }
      planStats[planId].orderCount++
      planStats[planId].revenue += Number(order.amount)
    })

    const topPlans = Object.entries(planStats)
      .map(([id, stats]) => ({
        id,
        ...stats
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return NextResponse.json({
      period: periodLabel,
      totalUsers,
      totalOrders,
      totalRevenue: revenue,
      averageOrderValue,
      topCustomers,
      topPlans
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
