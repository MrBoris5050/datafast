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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all vouchers with user information
    const vouchers = await prisma.voucher.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Create CSV content
    const headers = [
      'Code',
      'PIN',
      'Serial',
      'Type',
      'Price',
      'Is Active',
      'Is Used',
      'Is Sold',
      'Owner Name',
      'Owner Email',
      'Used At',
      'Expires At',
      'Created At'
    ]

    const csvRows = [
      headers.join(','),
      ...vouchers.map(voucher => [
        voucher.code,
        voucher.pin || '',
        voucher.serial || '',
        voucher.type,
        voucher.price.toString(),
        voucher.isActive ? 'Yes' : 'No',
        voucher.isUsed ? 'Yes' : 'No',
        voucher.isSold ? 'Yes' : 'No',
        voucher.user?.name || '',
        voucher.user?.email || '',
        voucher.usedAt ? new Date(voucher.usedAt).toISOString() : '',
        voucher.expiresAt ? new Date(voucher.expiresAt).toISOString() : '',
        new Date(voucher.createdAt).toISOString()
      ].map(field => `"${field}"`).join(','))
    ]

    const csvContent = csvRows.join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vouchers-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
