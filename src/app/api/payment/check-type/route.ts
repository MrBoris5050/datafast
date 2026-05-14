import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()
    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    // Check if it's a wallet topup transaction
    const tx = await prisma.transaction.findUnique({
      where: { reference },
      select: { type: true }
    })

    if (tx && tx.type === 'TOPUP') {
      return NextResponse.json({ isWalletTopup: true })
    }

    // Check if it's an order
    const order = await prisma.order.findUnique({
      where: { reference },
      select: { id: true }
    })

    if (order) {
      return NextResponse.json({ isWalletTopup: false })
    }

    // Not found
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  } catch (error) {
    console.error('Check transaction type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


