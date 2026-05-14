import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Expected networks from prisma/seed.ts
// These networks are seeded in the database and supported by the DataHubGH provider
const EXPECTED_NETWORKS = [
  { name: 'MTN', vtuKey: 'YELLO' },
  { name: 'TELECEL', vtuKey: 'TELECEL' },
  { name: 'AT BIGTIME', vtuKey: 'AT_BIGTIME' },
  { name: 'AT ISHARE', vtuKey: 'AT_PREMIUM' },
]

// Network name mappings for DataHubGH provider
// Maps network name variations to VTU provider keys (from src/lib/providers/datahubgh.ts)
const NETWORK_MAPPINGS: Record<string, string> = {
  // MTN networks (from seed.ts: 'MTN')
  'MTN': 'YELLO',
  
  // Telecel networks (from seed.ts: 'TELECEL')
  'TELECEL': 'TELECEL',
  
  // AT BIGTIME networks (from seed.ts: 'AT BIGTIME')
  'AT BIGTIME': 'AT_BIGTIME',
  'AT-BIGTIME': 'AT_BIGTIME',
  'BIGTIME': 'AT_BIGTIME',
  'AT BIG TIME': 'AT_BIGTIME',
  'BIG TIME': 'AT_BIGTIME',
  
  // AT ISHARE networks (from seed.ts: 'AT ISHARE')
  'AT ISHARE': 'AT_PREMIUM',
  'AT-ISHARE': 'AT_PREMIUM',
  'ISHARE': 'AT_PREMIUM',
  'AIRTELTIGO': 'AT_PREMIUM',
  'AIRTELTIGO GH': 'AT_PREMIUM',
  'TIGO': 'AT_PREMIUM',
  'AIRTEL': 'AT_PREMIUM',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all saved networks
    const savedNetworks = await prisma.network.findMany({
      orderBy: { name: 'asc' }
    })

    // Get all data plans to see what networks are actually being used
    const dataPlans = await prisma.dataPlan.findMany({
      select: { network: true },
      distinct: ['network']
    })

    const usedNetworks = dataPlans.map(p => p.network)
    const uniqueUsedNetworks = [...new Set(usedNetworks)]

    // Check which saved networks map to VTU keys
    const networkStatus = savedNetworks.map(network => {
      const upperName = network.name.toUpperCase().trim()
      const vtuKey = NETWORK_MAPPINGS[upperName] || upperName
      const isMapped = !!NETWORK_MAPPINGS[upperName]
      const isUsed = uniqueUsedNetworks.includes(network.name)

      return {
        id: network.id,
        name: network.name,
        vtuKey,
        isMapped,
        isUsed,
        isActive: network.isActive,
        createdAt: network.createdAt
      }
    })

    // Find missing expected networks
    const savedNetworkNames = savedNetworks.map(n => n.name.toUpperCase().trim())
    const missingNetworks = EXPECTED_NETWORKS.filter(
      expected => !savedNetworkNames.includes(expected.name.toUpperCase())
    )

    // Find networks in use that don't have mappings
    const unmappedNetworks = uniqueUsedNetworks.filter(networkName => {
      const upperName = networkName.toUpperCase().trim()
      return !NETWORK_MAPPINGS[upperName]
    })

    return NextResponse.json({
      success: true,
      data: {
        savedNetworks: networkStatus,
        missingNetworks,
        unmappedNetworks,
        usedNetworks: uniqueUsedNetworks,
        summary: {
          totalSaved: savedNetworks.length,
          totalUsed: uniqueUsedNetworks.length,
          totalMapped: networkStatus.filter(n => n.isMapped).length,
          totalUnmapped: networkStatus.filter(n => !n.isMapped).length,
          missingExpected: missingNetworks.length
        }
      }
    })
  } catch (error) {
    console.error('Error syncing networks:', error)
    return NextResponse.json({ error: 'Failed to sync networks' }, { status: 500 })
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      created: [] as string[],
      errors: [] as string[]
    }

    // Create missing expected networks
    for (const expected of EXPECTED_NETWORKS) {
      try {
        const existing = await prisma.network.findFirst({
          where: { name: { equals: expected.name, mode: 'insensitive' } }
        })

        if (!existing) {
          await prisma.network.create({
            data: {
              name: expected.name,
              isActive: true
            }
          })
          results.created.push(expected.name)
        }
      } catch (error: any) {
        results.errors.push(`Failed to create ${expected.name}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Created ${results.created.length} network(s)`
    })
  } catch (error) {
    console.error('Error creating missing networks:', error)
    return NextResponse.json({ error: 'Failed to create missing networks' }, { status: 500 })
  }
}

