import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's vouchers
    const vouchers = await prisma.voucher.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        purchases: {
          select: {
            reference: true,
            createdAt: true,
            method: true,
            phoneNumber: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1 // Get the most recent purchase
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group vouchers by type and status
    const stats = {
      total: vouchers.length,
      bece: {
        total: vouchers.filter(v => v.type === 'BECE').length,
        used: vouchers.filter(v => v.type === 'BECE' && v.isUsed).length,
        unused: vouchers.filter(v => v.type === 'BECE' && !v.isUsed).length
      },
      wassce: {
        total: vouchers.filter(v => v.type === 'WASSCE').length,
        used: vouchers.filter(v => v.type === 'WASSCE' && v.isUsed).length,
        unused: vouchers.filter(v => v.type === 'WASSCE' && !v.isUsed).length
      },
      totalValue: vouchers.reduce((sum, v) => sum + Number(v.price), 0)
    }

    return NextResponse.json({ vouchers, stats })
  } catch (error) {
    console.error('Error fetching user vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
