import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ networkName: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { networkName } = await params
    const decodedNetworkName = decodeURIComponent(networkName)
    const body = await req.json().catch(() => ({}))
    const { vtuKey, vtuSourceId, isActive } = body

    // Validate VTU source if provided
    if (vtuSourceId) {
      const vtuSource = await prisma.vtuSource.findUnique({ where: { id: vtuSourceId } })
      if (!vtuSource || !vtuSource.active) {
        return NextResponse.json({ error: 'Invalid or inactive VTU source' }, { status: 400 })
      }
    }

    const updated = await prisma.networkApiSetting.update({
      where: { networkName: decodedNetworkName },
      data: {
        ...(vtuKey !== undefined && { vtuKey }),
        ...(vtuSourceId !== undefined && { vtuSourceId: vtuSourceId || null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
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

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error updating network API setting:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Network API setting not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update network API setting' }, { status: 500 })
  }
}






