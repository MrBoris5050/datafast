import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDefaultVtuSource } from '@/lib/vtu'

const DATAHUBGH_API_KEY = process.env.DATAHUBGH_API_KEY
const DATAHUBGH_BASE_URL = process.env.DATAHUBGH_BASE_URL || 'https://user.datahubgh.com/api'
const USE_ENV_FOR_VTU = process.env.USE_ENV_FOR_VTU === 'true' || !!DATAHUBGH_API_KEY

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { reference } = await context.params
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference parameter' }, { status: 400 })
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { reference },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const network = order.plan.network

    // Get network-specific setting
    const networkSetting = await prisma.networkApiSetting.findUnique({
      where: { networkName: network },
      include: {
        vtuSource: {
          select: {
            id: true,
            name: true,
            provider: true,
            active: true,
            baseUrl: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })

    // Get default VTU source
    const defaultSource = await getDefaultVtuSource()

    // Analyze why it might have been marked as manual
    const analysis: {
      reason: string
      severity: 'error' | 'warning' | 'info'
      details: any
      recommendation?: string
    }[] = []

    // Check order status
    if (order.isManual) {
      analysis.push({
        reason: 'Order is marked as manual',
        severity: 'error',
        details: {
          isManual: order.isManual,
          status: order.status,
          providerReference: order.providerReference
        }
      })
    }

    // Check if order has provider reference
    if (!order.providerReference) {
      analysis.push({
        reason: 'Order has no provider reference',
        severity: 'warning',
        details: {
          providerReference: order.providerReference
        },
        recommendation: 'This suggests the VTU purchase was not successful or not attempted'
      })
    }

    // Check network setting
    if (!networkSetting) {
      analysis.push({
        reason: 'No NetworkApiSetting configured for this network',
        severity: 'error',
        details: {
          network
        },
        recommendation: 'Create a NetworkApiSetting for this network with a valid VTU source'
      })
    } else {
      // Check if network is active
      if (!networkSetting.isActive) {
        analysis.push({
          reason: 'Network is marked as inactive in NetworkApiSetting',
          severity: 'error',
          details: {
            network,
            networkSettingId: networkSetting.id,
            isActive: networkSetting.isActive
          },
          recommendation: 'Set isActive to true in NetworkApiSetting'
        })
      }

      // Check VTU source assignment
      if (!networkSetting.vtuSourceId) {
        analysis.push({
          reason: 'No VTU source assigned to network',
          severity: 'error',
          details: {
            network,
            networkSettingId: networkSetting.id,
            vtuSourceId: networkSetting.vtuSourceId
          },
          recommendation: 'Assign a VTU source to this network in NetworkApiSetting'
        })
      } else if (!networkSetting.vtuSource) {
        analysis.push({
          reason: 'VTU source ID exists but source not found (may have been deleted)',
          severity: 'error',
          details: {
            network,
            networkSettingId: networkSetting.id,
            vtuSourceId: networkSetting.vtuSourceId
          },
          recommendation: 'Reassign a valid VTU source to this network'
        })
      } else {
        // Check if VTU source is active
        if (!networkSetting.vtuSource.active) {
          analysis.push({
            reason: 'Assigned VTU source is inactive',
            severity: 'error',
            details: {
              network,
              vtuSourceId: networkSetting.vtuSource.id,
              vtuSourceName: networkSetting.vtuSource.name,
              active: networkSetting.vtuSource.active
            },
            recommendation: 'Activate the VTU source or assign a different active source'
          })
        }

        // Check provider type
        if (networkSetting.vtuSource.provider !== 'DATAHUBGH') {
          analysis.push({
            reason: 'VTU source provider is not DATAHUBGH',
            severity: 'warning',
            details: {
              network,
              provider: networkSetting.vtuSource.provider,
              expectedProvider: 'DATAHUBGH'
            }
          })
        }
      }
    }

    // Check default source (if network setting doesn't exist or has no source)
    if (!networkSetting || !networkSetting.vtuSourceId || !networkSetting.vtuSource) {
      if (!defaultSource) {
        analysis.push({
          reason: 'No default VTU source available',
          severity: 'error',
          details: {
            useEnvForVtu: USE_ENV_FOR_VTU,
            hasEnvApiKey: !!DATAHUBGH_API_KEY
          },
          recommendation: 'Configure a default VTU source or set DATAHUBGH_API_KEY environment variable'
        })
      } else if ('active' in defaultSource && !defaultSource.active) {
        analysis.push({
          reason: 'Default VTU source is inactive',
          severity: 'error',
          details: {
            defaultSourceId: defaultSource.id,
            defaultSourceName: defaultSource.name,
            active: defaultSource.active
          },
          recommendation: 'Activate the default VTU source'
        })
      }
    }

    // Check order timing
    const orderAge = Date.now() - order.createdAt.getTime()
    const orderAgeHours = Math.floor(orderAge / (1000 * 60 * 60))
    const orderAgeMinutes = Math.floor((orderAge % (1000 * 60 * 60)) / (1000 * 60))

    // Simulate what would happen if we tried to process this order now
    let simulationResult: {
      wouldSucceed: boolean
      wouldUseManual: boolean
      reason?: string
      source?: any
    } | null = null

    if (networkSetting) {
      if (!networkSetting.isActive) {
        simulationResult = {
          wouldSucceed: false,
          wouldUseManual: true,
          reason: 'Network is inactive'
        }
      } else if (!networkSetting.vtuSourceId || !networkSetting.vtuSource) {
        simulationResult = {
          wouldSucceed: false,
          wouldUseManual: true,
          reason: 'No VTU source assigned'
        }
      } else if (!networkSetting.vtuSource.active) {
        simulationResult = {
          wouldSucceed: false,
          wouldUseManual: true,
          reason: 'VTU source is inactive'
        }
      } else {
        simulationResult = {
          wouldSucceed: true,
          wouldUseManual: false,
          reason: 'Configuration looks correct',
          source: {
            id: networkSetting.vtuSource.id,
            name: networkSetting.vtuSource.name,
            provider: networkSetting.vtuSource.provider
          }
        }
      }
    } else if (defaultSource) {
      if ('active' in defaultSource && !defaultSource.active) {
        simulationResult = {
          wouldSucceed: false,
          wouldUseManual: true,
          reason: 'Default VTU source is inactive'
        }
      } else {
        simulationResult = {
          wouldSucceed: true,
          wouldUseManual: false,
          reason: 'Would use default VTU source',
          source: {
            id: defaultSource.id,
            name: defaultSource.name,
            provider: defaultSource.provider,
            source: USE_ENV_FOR_VTU && DATAHUBGH_API_KEY ? 'environment' : 'database'
          }
        }
      }
    } else {
      simulationResult = {
        wouldSucceed: false,
        wouldUseManual: true,
        reason: 'No VTU source available'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          reference: order.reference,
          orderNumber: order.orderNumber,
          status: order.status,
          isManual: order.isManual,
          amount: Number(order.amount),
          phone: order.phone,
          providerReference: order.providerReference,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        },
        plan: {
          id: order.plan.id,
          name: order.plan.name,
          network: order.plan.network,
          dataAmount: order.plan.dataAmount
        },
        user: order.user,
        payment: order.payments[0] ? {
          id: order.payments[0].id,
          status: order.payments[0].status,
          method: order.payments[0].method
        } : null,
        orderAge: {
          hours: orderAgeHours,
          minutes: orderAgeMinutes,
          totalMinutes: Math.floor(orderAge / (1000 * 60))
        },
        configuration: {
          networkSetting: networkSetting ? {
            id: networkSetting.id,
            networkName: networkSetting.networkName,
            isActive: networkSetting.isActive,
            vtuKey: networkSetting.vtuKey,
            vtuSourceId: networkSetting.vtuSourceId,
            vtuSource: networkSetting.vtuSource
          } : null,
          defaultSource: defaultSource ? {
            id: defaultSource.id,
            name: defaultSource.name,
            provider: defaultSource.provider,
            active: 'active' in defaultSource ? defaultSource.active : true,
            source: USE_ENV_FOR_VTU && DATAHUBGH_API_KEY ? 'environment' : 'database'
          } : null,
          environment: {
            hasEnvApiKey: !!DATAHUBGH_API_KEY,
            baseUrl: DATAHUBGH_BASE_URL,
            useEnvForVtu: USE_ENV_FOR_VTU
          }
        },
        analysis,
        simulation: simulationResult,
        summary: {
          primaryIssue: analysis.find(a => a.severity === 'error')?.reason || 'No issues found',
          allIssues: analysis.filter(a => a.severity === 'error').map(a => a.reason),
          wouldWorkNow: simulationResult?.wouldSucceed || false
        }
      }
    })
  } catch (error: any) {
    console.error('Error analyzing order:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze order' },
      { status: 500 }
    )
  }
}

