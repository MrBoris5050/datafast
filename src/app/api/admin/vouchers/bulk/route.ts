import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getVoucherPrice } from '@/lib/voucher-pricing'

// Generate unique voucher code
function generateVoucherCode(type: 'BECE' | 'WASSCE'): string {
  const prefix = type === 'BECE' ? 'BC' : 'WS'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

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

    const { type, quantity } = await request.json()

    if (!type || !['BECE', 'WASSCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 })
    }

    // Get default price for voucher type
    const defaultPrice = await getVoucherPrice(type as 'BECE' | 'WASSCE')

    if (quantity < 1 || quantity > 1000) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 1000' }, { status: 400 })
    }

    // Generate unique codes in batches to avoid collisions
    const vouchers = []
    const existingCodes = new Set()
    
    // Get existing codes to avoid duplicates
    const existing = await prisma.voucher.findMany({
      select: { code: true }
    })
    existing.forEach(v => existingCodes.add(v.code))

    for (let i = 0; i < quantity; i++) {
      let code = generateVoucherCode(type)
      let attempts = 0
      
      // Ensure uniqueness
      while (existingCodes.has(code) && attempts < 10) {
        code = generateVoucherCode(type) + Math.random().toString(36).substring(2, 2).toUpperCase()
        attempts++
      }
      
      existingCodes.add(code)
      vouchers.push({
        code,
        type,
        price: defaultPrice
      })
    }

    // Create vouchers in batches of 100 to avoid timeout
    const batchSize = 100
    let created = 0
    
    for (let i = 0; i < vouchers.length; i += batchSize) {
      const batch = vouchers.slice(i, i + batchSize)
      await prisma.voucher.createMany({
        data: batch,
        skipDuplicates: true
      })
      created += batch.length
    }

    return NextResponse.json({ 
      success: true, 
      message: `${created} vouchers created successfully`,
      count: created
    })
  } catch (error) {
    console.error('Error creating bulk vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
