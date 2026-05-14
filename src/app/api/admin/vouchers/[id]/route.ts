import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { isActive } = await request.json()
    const { id: voucherId } = await params

    // Update voucher
    const voucher = await prisma.voucher.update({
      where: { id: voucherId },
      data: { isActive: Boolean(isActive) }
    })

    return NextResponse.json({ 
      success: true, 
      voucher,
      message: `Voucher ${isActive ? 'activated' : 'deactivated'} successfully`
    })
  } catch (error) {
    console.error('Error updating voucher:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: voucherId } = await params

    // Check if voucher is used
    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId }
    })

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    if (voucher.isUsed) {
      return NextResponse.json({ error: 'Cannot delete used voucher' }, { status: 400 })
    }

    // Delete voucher
    await prisma.voucher.delete({
      where: { id: voucherId }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Voucher deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting voucher:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
