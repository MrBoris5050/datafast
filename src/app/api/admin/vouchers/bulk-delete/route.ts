import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
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

    const { voucherIds } = await request.json()

    if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
      return NextResponse.json({ error: 'Invalid voucher IDs' }, { status: 400 })
    }

    // Check if any vouchers are used or sold
    const vouchers = await prisma.voucher.findMany({
      where: {
        id: { in: voucherIds }
      },
      select: {
        id: true,
        isUsed: true,
        isSold: true,
        userId: true
      }
    })

    // Filter out vouchers that are used or sold
    const deletableIds = vouchers
      .filter(v => !v.isUsed && !v.isSold && !v.userId)
      .map(v => v.id)

    if (deletableIds.length === 0) {
      return NextResponse.json({ 
        error: 'No vouchers can be deleted. Vouchers that are used, sold, or assigned to users cannot be deleted.' 
      }, { status: 400 })
    }

    // Delete vouchers
    const result = await prisma.voucher.deleteMany({
      where: {
        id: { in: deletableIds }
      }
    })

    const skipped = voucherIds.length - deletableIds.length

    return NextResponse.json({
      success: true,
      message: `${result.count} voucher(s) deleted successfully${skipped > 0 ? `. ${skipped} voucher(s) skipped (used, sold, or assigned).` : ''}`,
      deleted: result.count,
      skipped
    })
  } catch (error) {
    console.error('Error deleting vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




