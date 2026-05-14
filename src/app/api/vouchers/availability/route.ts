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

    // Count available vouchers (not assigned to any user, active, not used, not expired)
    const [beceAvailable, wassceAvailable, beceTotal, wassceTotal] = await Promise.all([
      prisma.voucher.count({
        where: {
          type: 'BECE',
          isActive: true,
          isUsed: false,
          userId: null, // Not assigned to any user
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      prisma.voucher.count({
        where: {
          type: 'WASSCE',
          isActive: true,
          isUsed: false,
          userId: null, // Not assigned to any user
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      prisma.voucher.count({
        where: {
          type: 'BECE',
          isActive: true
        }
      }),
      prisma.voucher.count({
        where: {
          type: 'WASSCE',
          isActive: true
        }
      })
    ])

    const stats = {
      bece: {
        available: beceAvailable,
        total: beceTotal
      },
      wassce: {
        available: wassceAvailable,
        total: wassceTotal
      }
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching voucher availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

