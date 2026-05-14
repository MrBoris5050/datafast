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
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const userId = searchParams.get('userId') // Filter by specific user
  const transactionType = searchParams.get('transactionType') // CREDIT or DEBIT filter
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')
  const skip = (page - 1) * limit

  const where: any = {}
  if (status && status !== 'ALL') where.status = status
  if (type && type !== 'ALL') where.type = type
  if (userId) where.userId = userId // Filter by specific user if provided
  
  // Filter by transaction type (CREDIT or DEBIT)
  // Note: TransactionType enum has: PURCHASE, REFUND, COMMISSION, BONUS, TOPUP, DEBIT
  if (transactionType === 'CREDIT') {
    where.type = { in: ['TOPUP', 'BONUS', 'COMMISSION'] }
  } else if (transactionType === 'DEBIT') {
    where.type = { in: ['PURCHASE', 'DEBIT'] }
  }
  
  // Filter by date range
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      where.createdAt.gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }
  
  if (search) {
    const searchUsers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
    const userIds = searchUsers.map(u => u.id)
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
    ]
  }

  // If filtering by userId, calculate balance before/after
  let balanceMap = new Map<string, { before: number; after: number }>()
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    })
    const currentBalance = Number(user?.walletBalance || 0)

    // Get all transactions for this user to calculate balances
    const allUserTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate balance backwards from current balance
    let runningBalance = currentBalance
    for (const tx of allUserTransactions) {
      const amount = Number(tx.amount)
      const afterBalance = runningBalance
      
      let beforeBalance = runningBalance
      if (tx.status === 'COMPLETED') {
        // Credit types: TOPUP, REFUND, COMMISSION, BONUS (add money to wallet)
        if (tx.type === 'TOPUP' || tx.type === 'REFUND' || tx.type === 'COMMISSION' || tx.type === 'BONUS') {
          beforeBalance = runningBalance - amount
        } 
        // Debit types: PURCHASE, DEBIT (remove money from wallet)
        else if (tx.type === 'PURCHASE' || tx.type === 'DEBIT') {
          beforeBalance = runningBalance + amount
        }
      }
      
      balanceMap.set(tx.id, { before: beforeBalance, after: afterBalance })
      runningBalance = beforeBalance
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  
  const total = await prisma.transaction.count({ where })
  
  const userIds = [...new Set(transactions.map(t => t.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  })
  
  const userMap = new Map(users.map(u => [u.id, u]))

  const data = transactions.map((t) => {
    const user = userMap.get(t.userId)
    const balanceInfo = balanceMap.get(t.id) || { before: undefined, after: undefined }
    return {
      id: t.id,
      reference: t.reference,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      description: t.description,
      userName: user?.name || 'N/A',
      userEmail: user?.email || '',
      createdAt: t.createdAt.toISOString(),
      balanceBefore: balanceInfo.before,
      balanceAfter: balanceInfo.after,
    }
  })

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

