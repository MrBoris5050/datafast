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

    const { voucherIds, isSold } = await request.json()

    if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
      return NextResponse.json({ error: 'Invalid voucher IDs' }, { status: 400 })
    }

    if (typeof isSold !== 'boolean') {
      return NextResponse.json({ error: 'isSold must be a boolean' }, { status: 400 })
    }

    // Update vouchers
    const result = await prisma.voucher.updateMany({
      where: {
        id: { in: voucherIds }
      },
      data: {
        isSold: isSold
      }
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} voucher(s) ${isSold ? 'marked as sold' : 'unmarked as sold'} successfully`,
      updated: result.count
    })
  } catch (error) {
    console.error('Error updating vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




