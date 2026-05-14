import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all network API settings with their VTU sources
    const settings = await prisma.networkApiSetting.findMany({
      include: {
        vtuSource: {
          select: {
            id: true,
            name: true,
            provider: true,
            active: true,
          }
        }
      },
      orderBy: { networkName: 'asc' }
    })

    // Get all unique networks from data plans
    const dataPlans = await prisma.dataPlan.findMany({
      select: { network: true },
      distinct: ['network']
    })
    const usedNetworks = [...new Set(dataPlans.map(p => p.network))]

    // Get all VTU sources for the dropdown
    const vtuSources = await prisma.vtuSource.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    })

    // Create a map of existing settings by network name
    const settingsMap = new Map(settings.map(s => [s.networkName, s]))

    // Build response with all networks (used in data plans)
    const networkSettings = usedNetworks.map(networkName => {
      const existing = settingsMap.get(networkName)
      return {
        id: existing?.id || null,
        networkName,
        vtuKey: existing?.vtuKey || networkName.toUpperCase().replace(/\s+/g, '_'),
        vtuSourceId: existing?.vtuSourceId || null,
        isActive: existing?.isActive ?? true,
        vtuSource: existing?.vtuSource || null,
        createdAt: existing?.createdAt,
        updatedAt: existing?.updatedAt,
      }
    })

    return NextResponse.json({ 
      success: true, 
      data: networkSettings,
      vtuSources 
    })
  } catch (error) {
    console.error('Error fetching network API settings:', error)
    return NextResponse.json({ error: 'Failed to fetch network API settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { networkName, vtuKey, vtuSourceId, isActive } = body

    if (!networkName || !vtuKey) {
      return NextResponse.json({ error: 'Missing required fields: networkName and vtuKey' }, { status: 400 })
    }

    // Validate VTU source if provided
    if (vtuSourceId) {
      const vtuSource = await prisma.vtuSource.findUnique({ where: { id: vtuSourceId } })
      if (!vtuSource || !vtuSource.active) {
        return NextResponse.json({ error: 'Invalid or inactive VTU source' }, { status: 400 })
      }
    }

    // Upsert the setting
    const setting = await prisma.networkApiSetting.upsert({
      where: { networkName },
      update: {
        vtuKey,
        vtuSourceId: vtuSourceId || null,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        networkName,
        vtuKey,
        vtuSourceId: vtuSourceId || null,
        isActive: isActive ?? true,
      },
      include: {
        vtuSource: {
          select: {
            id: true,
            name: true,
            provider: true,
            active: true,
          }
        }
      }
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error: any) {
    console.error('Error creating/updating network API setting:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Network API setting already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to save network API setting' }, { status: 500 })
  }
}






