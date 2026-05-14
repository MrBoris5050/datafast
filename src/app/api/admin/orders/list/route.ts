import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
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
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')
  const skip = (page - 1) * limit

  const where: any = {}
  if (status && status !== 'ALL') where.status = status
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
  // Date filtering (UTC day bounds — matches admin/stats and avoids local TZ drift)
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { name: true, network: true, dataAmount: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  const data = orders.map((o) => ({
    id: o.id,
    orderId: o.id.slice(-6).toUpperCase(),
    orderNumber: o.orderNumber || 0,
    userId: o.userId,
    userName: o.user.name || 'N/A',
    userEmail: o.user.email,
    planName: o.plan?.name || 'Plan',
    network: o.plan?.network || 'Unknown',
    dataAmount: o.plan?.dataAmount || 0,
    amount: Number(o.amount),
    phone: o.phone,
    reference: o.reference,
    status: o.status,
    isManual: o.isManual || false,
    createdAt: o.createdAt.toISOString(),
  }))

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}


