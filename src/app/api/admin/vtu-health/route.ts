import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getAllCircuitBreakerStats, 
  getCircuitBreaker,
  isVtuProviderAvailable 
} from '@/lib/circuit-breaker'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/vtu-health
 * Get VTU provider health status and circuit breaker stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get circuit breaker stats
    const circuitBreakerStats = getAllCircuitBreakerStats()

    // Get recent order stats (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const [
      totalOrders,
      processingOrders,
      completedOrders,
      failedOrders,
      manualOrders
    ] = await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: oneHourAgo } }
      }),
      prisma.order.count({
        where: { status: 'PROCESSING', createdAt: { gte: oneHourAgo } }
      }),
      prisma.order.count({
        where: { status: 'COMPLETED', createdAt: { gte: oneHourAgo } }
      }),
      prisma.order.count({
        where: { status: 'FAILED', createdAt: { gte: oneHourAgo } }
      }),
      prisma.order.count({
        where: { isManual: true, createdAt: { gte: oneHourAgo } }
      })
    ])

    // Get VTU sources status
    const vtuSources = await prisma.vtuSource.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        active: true,
        isDefault: true,
        updatedAt: true
      }
    })

    // Get network settings
    const networkSettings = await prisma.networkApiSetting.findMany({
      select: {
        networkName: true,
        isActive: true,
        vtuSourceId: true,
        vtuSource: {
          select: {
            name: true,
            provider: true,
            active: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      circuitBreakers: circuitBreakerStats,
      providers: {
        dataHubGH: {
          available: isVtuProviderAvailable('DataHubGH'),
          stats: circuitBreakerStats['DataHubGH'] || null
        }
      },
      recentStats: {
        period: 'last_hour',
        total: totalOrders,
        processing: processingOrders,
        completed: completedOrders,
        failed: failedOrders,
        manual: manualOrders,
        successRate: totalOrders > 0 
          ? ((completedOrders / totalOrders) * 100).toFixed(2) + '%'
          : 'N/A'
      },
      vtuSources: vtuSources.map(source => ({
        ...source,
        circuitBreakerAvailable: isVtuProviderAvailable(source.name)
      })),
      networkSettings: networkSettings.map(ns => ({
        network: ns.networkName,
        active: ns.isActive,
        vtuSource: ns.vtuSource ? {
          name: ns.vtuSource.name,
          provider: ns.vtuSource.provider,
          active: ns.vtuSource.active
        } : null,
        mode: !ns.isActive ? 'inactive' : (!ns.vtuSourceId ? 'manual' : 'automatic')
      }))
    })
  } catch (error: any) {
    console.error('VTU health API error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to get VTU health status' 
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/vtu-health
 * Reset circuit breaker or perform health actions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, provider = 'DataHubGH' } = body

    if (action === 'reset-circuit-breaker') {
      const breaker = getCircuitBreaker(provider)
      breaker.reset()
      
      return NextResponse.json({
        success: true,
        message: `Circuit breaker for ${provider} has been reset`,
        newState: breaker.getStats()
      })
    }

    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: reset-circuit-breaker' 
    }, { status: 400 })
  } catch (error: any) {
    console.error('VTU health action error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to perform action' 
    }, { status: 500 })
  }
}
