import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // Optional filter by transaction type
    const transactionType = searchParams.get('transactionType') // CREDIT or DEBIT filter
    const status = searchParams.get('status') // Filter by transaction status
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const skip = (page - 1) * limit

    const where: any = { userId: session.user.id }
    if (type) {
      where.type = type
    }
    
    // Filter by transaction status
    if (status && status !== 'ALL') {
      where.status = status
    }
    
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

    // Get user's current balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalance: true },
    })
    const currentBalance = Number(user?.walletBalance || 0)

    // Get all transactions for balance calculation (ordered by date DESC to work backwards)
    const allTransactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate balance backwards from current balance
    // This ensures accuracy even if there are untracked transactions
    let runningBalance = currentBalance
    const balanceMap = new Map<string, { before: number; after: number }>()

    // Process transactions in reverse chronological order (newest first)
    // to calculate what the balance was before each transaction
    for (const tx of allTransactions) {
      const amount = Number(tx.amount)
      
      // Calculate balance after this transaction (current running balance)
      const afterBalance = runningBalance
      
      // Reverse the transaction to get balance before
      let beforeBalance = runningBalance
      if (tx.status === 'COMPLETED') {
        // Credit types: TOPUP, REFUND, COMMISSION, BONUS (add money to wallet)
        if (tx.type === 'TOPUP' || tx.type === 'REFUND' || tx.type === 'COMMISSION' || tx.type === 'BONUS') {
          // If this was a credit, subtract it to get balance before
          beforeBalance = runningBalance - amount
        } 
        // Debit types: PURCHASE, DEBIT (remove money from wallet)
        else if (tx.type === 'PURCHASE' || tx.type === 'DEBIT') {
          // If this was a debit, add it back to get balance before
          beforeBalance = runningBalance + amount
        }
      }
      
      balanceMap.set(tx.id, { before: beforeBalance, after: afterBalance })
      
      // Update running balance to be the balance before this transaction
      runningBalance = beforeBalance
    }

    // Now get paginated transactions
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    const data = items.map((t) => {
      const balanceInfo = balanceMap.get(t.id) || { before: 0, after: 0 }
      return {
        id: t.id,
        reference: t.reference,
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        description: t.description,
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
  } catch (error) {
    console.error('Transactions list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


