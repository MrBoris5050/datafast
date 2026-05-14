import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Missing order id' }, { status: 400 })

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id },
      include: { plan: true, user: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Switch order to manual processing
    const updated = await prisma.order.update({
      where: { id },
      data: {
        isManual: true,
        providerReference: null, // Clear provider reference
        status: 'PENDING', // Reset to pending for manual processing
      },
    })

    return NextResponse.json({ 
      success: true, 
      data: updated,
      message: 'Order switched to manual processing'
    })
  } catch (error: any) {
    console.error('Error switching order to manual:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to switch order to manual' },
      { status: 500 }
    )
  }
}

