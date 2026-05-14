import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDefaultVtuSource } from '@/lib/vtu'

const DATAHUBGH_API_KEY = process.env.DATAHUBGH_API_KEY
const DATAHUBGH_BASE_URL = process.env.DATAHUBGH_BASE_URL || 'https://user.datahubgh.com/api'
const USE_ENV_FOR_VTU = process.env.USE_ENV_FOR_VTU === 'true' || !!DATAHUBGH_API_KEY

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const networkName = searchParams.get('network')

    // Get all network API settings
    const networkSettings = await prisma.networkApiSetting.findMany({
      include: {
        vtuSource: {
          select: {
            id: true,
            name: true,
            provider: true,
            active: true,
            baseUrl: true,
            isDefault: true,
          }
        }
      },
      orderBy: { networkName: 'asc' }
    })

    // Get all VTU sources
    const vtuSources = await prisma.vtuSource.findMany({
      orderBy: { name: 'asc' }
    })

    // Get default VTU source
    const defaultSource = await getDefaultVtuSource()

    // Get all unique networks from data plans
    const dataPlans = await prisma.dataPlan.findMany({
      select: { network: true },
      distinct: ['network']
    })
    const allNetworks = [...new Set(dataPlans.map(p => p.network))]

    // Get recent manual orders (last 50)
    const recentManualOrders = await prisma.order.findMany({
      where: {
        isManual: true,
        ...(networkName ? { plan: { network: networkName } } : {})
      },
      include: {
        plan: {
          select: { network: true, name: true }
        },
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Analyze each network's configuration
    const networkAnalysis = allNetworks.map(network => {
      const setting = networkSettings.find(s => s.networkName === network)
      
      let status: 'ok' | 'warning' | 'error' = 'ok'
      const issues: string[] = []
      const recommendations: string[] = []

      if (!setting) {
        status = 'warning'
        issues.push('No NetworkApiSetting configured')
        recommendations.push('Create a NetworkApiSetting for this network')
      } else {
        if (!setting.isActive) {
          status = 'error'
          issues.push('Network is marked as inactive')
          recommendations.push('Set isActive to true in NetworkApiSetting')
        }

        if (!setting.vtuSourceId) {
          status = 'error'
          issues.push('No VTU source assigned')
          recommendations.push('Assign a VTU source to this network')
        } else if (!setting.vtuSource) {
          status = 'error'
          issues.push('VTU source ID exists but source not found (may be deleted)')
          recommendations.push('Reassign a valid VTU source to this network')
        } else {
          if (!setting.vtuSource.active) {
            status = 'error'
            issues.push('Assigned VTU source is inactive')
            recommendations.push('Activate the VTU source or assign a different active source')
          }

          if (setting.vtuSource.provider !== 'DATAHUBGH') {
            status = 'warning'
            issues.push(`VTU source provider is ${setting.vtuSource.provider}, not DATAHUBGH`)
          }
        }
      }

      // Check if default source would be used
      if (!setting || !setting.vtuSourceId || !setting.vtuSource) {
        if (!defaultSource) {
          status = 'error'
          issues.push('No default VTU source available')
          recommendations.push('Configure a default VTU source or set DATAHUBGH_API_KEY environment variable')
        } else if ('active' in defaultSource && !defaultSource.active) {
          status = 'error'
          issues.push('Default VTU source is inactive')
          recommendations.push('Activate the default VTU source')
        }
      }

      return {
        network,
        setting: setting ? {
          id: setting.id,
          isActive: setting.isActive,
          vtuSourceId: setting.vtuSourceId,
          vtuKey: setting.vtuKey,
          vtuSource: setting.vtuSource
        } : null,
        status,
        issues,
        recommendations
      }
    })

    // Count manual orders by network
    const manualOrdersByNetwork = await prisma.order.groupBy({
      by: ['planId'],
      where: {
        isManual: true,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      _count: { _all: true }
    })

    const planIds = manualOrdersByNetwork.map(g => g.planId)
    const plans = await prisma.dataPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, network: true, name: true }
    })

    const manualCounts = new Map<string, number>()
    manualOrdersByNetwork.forEach(g => {
      const plan = plans.find(p => p.id === g.planId)
      if (plan) {
        manualCounts.set(plan.network, (manualCounts.get(plan.network) || 0) + g._count._all)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        environment: {
          hasEnvApiKey: !!DATAHUBGH_API_KEY,
          baseUrl: DATAHUBGH_BASE_URL,
          useEnvForVtu: USE_ENV_FOR_VTU,
          defaultSource: defaultSource ? {
            id: defaultSource.id,
            name: defaultSource.name,
            provider: defaultSource.provider,
            active: 'active' in defaultSource ? defaultSource.active : true,
            source: USE_ENV_FOR_VTU && DATAHUBGH_API_KEY ? 'environment' : 'database'
          } : null
        },
        vtuSources: vtuSources.map(s => ({
          id: s.id,
          name: s.name,
          provider: s.provider,
          active: s.active,
          isDefault: s.isDefault,
          baseUrl: s.baseUrl,
          hasApiKey: !!s.apiKey
        })),
        networkAnalysis,
        manualOrders: {
          recent: recentManualOrders.map(o => ({
            id: o.id,
            reference: o.reference,
            network: o.plan.network,
            planName: o.plan.name,
            phone: o.phone,
            status: o.status,
            createdAt: o.createdAt,
            providerReference: o.providerReference
          })),
          countsByNetwork: Object.fromEntries(manualCounts),
          total: recentManualOrders.length
        }
      }
    })
  } catch (error: any) {
    console.error('Error in VTU diagnostics:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate diagnostics' },
      { status: 500 }
    )
  }
}

