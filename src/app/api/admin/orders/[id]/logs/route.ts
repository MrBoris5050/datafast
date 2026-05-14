import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrderLogs } from '@/lib/order-logs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, reference: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Get logs
    const logs = await getOrderLogs(id)

    // Parse metadata
    const logsWithParsedMetadata = logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null
    }))

    return NextResponse.json({
      success: true,
      data: logsWithParsedMetadata,
      order: {
        id: order.id,
        reference: order.reference
      }
    })
  } catch (error: any) {
    console.error('Error fetching order logs:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch order logs' },
      { status: 500 }
    )
  }
}

