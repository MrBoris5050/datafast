import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const network = searchParams.get('network')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') || 'csv'

    const where: any = {}

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (network && network !== 'ALL') {
      where.plan = { network }
    }

    if (source && source !== 'ALL') {
      if (source === 'MANUAL') {
        where.isManual = true
      } else if (source === 'API') {
        where.isManual = false
      }
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Date filtering (UTC day bounds — same as admin orders list)
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
      }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { network: true, dataAmount: true } },
      },
    })

    const data = orders.map((order) => {
      const rawAmountMb = order.plan?.dataAmount ?? 0
      let dataSize: string
      if (rawAmountMb >= 1024) {
        const gb = rawAmountMb / 1024
        // Show number only with full decimal precision (including .0)
        dataSize = gb.toFixed(0)
      } else {
        // For MB, show just the number
        dataSize = String(rawAmountMb)
      }

      return {
        orderNumber: order.orderNumber ? String(order.orderNumber).padStart(3, '0') : '---',
        network: order.plan?.network ?? 'N/A',
        phone: String(order.phone || ''), // Ensure phone is always a string to preserve leading zeros
        dataSize,
        amount: Number(order.amount).toFixed(2),
        dateTime: order.createdAt.toISOString(),
        status: order.status,
      }
    })

    if (format === 'json') {
      return NextResponse.json({ success: true, data })
    }

    const headers = [
      'Order Number',
      'Network',
      'Phone',
      'Data Size',
      'Amount',
      'Date/Time',
      'Status',
    ]

    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        [
          row.orderNumber,
          row.network,
          row.phone,
          row.dataSize,
          row.amount,
          row.dateTime,
          row.status,
        ]
          .map((field, index) => {
            const fieldStr = String(field ?? '')
            // For phone numbers (index 2), use equals-quote format to force Excel to treat as text and preserve leading zeros
            if (index === 2 && fieldStr) {
              return `="${fieldStr.replace(/"/g, '""')}"`
            }
            return `"${fieldStr.replace(/"/g, '""')}"`
          })
          .join(',')
      ),
    ]

    const csvContent = csvRows.join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-export-${new Date()
          .toISOString()
          .split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting orders:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to export orders' },
      { status: 500 }
    )
  }
}









