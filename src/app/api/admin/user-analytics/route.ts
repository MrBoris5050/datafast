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

    // Parse dates or use defaults (last 7 days)
    const now = new Date()
    const defaultStart = new Date()
    defaultStart.setDate(now.getDate() - 7)
    
    const start = startDate ? new Date(startDate) : defaultStart
    const end = endDate ? new Date(endDate) : now
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999)
    start.setHours(0, 0, 0, 0)

    // Calculate previous period for comparison
    const periodDuration = end.getTime() - start.getTime()
    const previousStart = new Date(start.getTime() - periodDuration)
    const previousEnd = new Date(start.getTime() - 1)

    // Get user stats for the selected period
    const [
      totalUsers,
      newUsersInPeriod,
      previousPeriodUsers,
      usersByRole,
      activeUsers,
      inactiveUsers,
      topUsersByOrders,
      topUsersBySpending,
      dailyRegistrations,
      usersByMonth
    ] = await Promise.all([
      // Total users count
      prisma.user.count(),
      
      // New users in selected period
      prisma.user.count({
        where: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      }),
      
      // Previous period users for comparison
      prisma.user.count({
        where: {
          createdAt: {
            gte: previousStart,
            lte: previousEnd
          }
        }
      }),
      
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      }),
      
      // Active users (users who have placed orders in the period)
      prisma.user.count({
        where: {
          orders: {
            some: {
              createdAt: {
                gte: start,
                lte: end
              }
            }
          }
        }
      }),
      
      // Inactive users count
      prisma.user.count({
        where: {
          isActive: false
        }
      }),
      
      // Top users by order count in period
      prisma.user.findMany({
        where: {
          orders: {
            some: {
              createdAt: {
                gte: start,
                lte: end
              }
            }
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          _count: {
            select: {
              orders: {
                where: {
                  createdAt: {
                    gte: start,
                    lte: end
                  }
                }
              }
            }
          }
        },
        orderBy: {
          orders: {
            _count: 'desc'
          }
        },
        take: 10
      }),
      
      // Top users by spending in period
      prisma.order.groupBy({
        by: ['userId'],
        _sum: { amount: true },
        _count: { id: true },
        where: {
          createdAt: {
            gte: start,
            lte: end
          },
          status: 'COMPLETED'
        },
        orderBy: {
          _sum: {
            amount: 'desc'
          }
        },
        take: 10
      }),
      
      // Daily registration trend
      prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM users
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      
      // Users by month (last 6 months)
      prisma.$queryRaw`
        SELECT 
          TO_CHAR("createdAt", 'YYYY-MM') as month,
          COUNT(*) as count
        FROM users
        WHERE "createdAt" >= ${new Date(now.getFullYear(), now.getMonth() - 5, 1)}
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month ASC
      `
    ])

    // Get user details for top spenders
    const topSpenderIds = (topUsersBySpending as any[]).map(u => u.userId)
    const topSpenderDetails = await prisma.user.findMany({
      where: { id: { in: topSpenderIds } },
      select: { id: true, name: true, email: true, role: true }
    })

    // Map spender details
    const topSpenders = (topUsersBySpending as any[]).map(spender => {
      const user = topSpenderDetails.find(u => u.id === spender.userId)
      return {
        id: spender.userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        role: user?.role || 'CUSTOMER',
        totalSpent: Number(spender._sum.amount || 0),
        orderCount: spender._count.id
      }
    })

    // Calculate growth percentage
    const growthPercentage = previousPeriodUsers > 0
      ? ((newUsersInPeriod - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(1)
      : newUsersInPeriod > 0 ? '100' : '0'

    // Format role distribution
    const roleDistribution = (usersByRole as any[]).map(r => ({
      role: r.role,
      count: r._count.id
    }))

    // Calculate total wallet balance
    const walletSum = await prisma.user.aggregate({
      _sum: { walletBalance: true }
    })

    // Get users with positive balance count
    const usersWithBalance = await prisma.user.count({
      where: {
        walletBalance: { gt: 0 }
      }
    })

    // Recent registrations
    const recentRegistrations = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        walletBalance: true,
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          newUsersInPeriod,
          previousPeriodUsers,
          growthPercentage: Number(growthPercentage),
          activeUsers,
          inactiveUsers,
          usersWithBalance,
          totalWalletBalance: Number(walletSum._sum.walletBalance || 0)
        },
        roleDistribution,
        topUsersByOrders: (topUsersByOrders as any[]).map(u => ({
          id: u.id,
          name: u.name || 'Unknown',
          email: u.email,
          role: u.role,
          orderCount: u._count.orders
        })),
        topUsersBySpending: topSpenders,
        dailyRegistrations: (dailyRegistrations as any[]).map(d => ({
          date: d.date,
          count: Number(d.count)
        })),
        monthlyTrend: (usersByMonth as any[]).map(m => ({
          month: m.month,
          count: Number(m.count)
        })),
        recentRegistrations: recentRegistrations.map(u => ({
          id: u.id,
          name: u.name || 'Unknown',
          email: u.email,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
          walletBalance: Number(u.walletBalance),
          orderCount: u._count.orders
        })),
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching user analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch user analytics' }, { status: 500 })
  }
}
