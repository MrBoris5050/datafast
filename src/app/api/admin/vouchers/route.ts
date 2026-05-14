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

    // Fetch vouchers with user information
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

    // Calculate stats
    const stats = {
      total: vouchers.length,
      active: vouchers.filter(v => v.isActive).length,
      used: vouchers.filter(v => v.isUsed).length,
      unused: vouchers.filter(v => !v.isUsed).length,
      beceCount: vouchers.filter(v => v.type === 'BECE').length,
      wassceCount: vouchers.filter(v => v.type === 'WASSCE').length,
      totalValue: vouchers.reduce((sum, v) => sum + Number(v.price), 0)
    }

    return NextResponse.json({ vouchers, stats })
  } catch (error) {
    console.error('Error fetching vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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

    const { type, quantity = 1, expiresAt, pin, serial, code } = await request.json()

    if (!type || !['BECE', 'WASSCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 })
    }

    // Get default price for voucher type
    const defaultPrice = await getVoucherPrice(type as 'BECE' | 'WASSCE')

    // If PIN and serial are provided, create single voucher with those values
    if (pin && serial) {
      // Use provided code or generate one
      const voucherCode = code || generateVoucherCode(type)
      
      // Check for duplicates
      const existing = await prisma.voucher.findFirst({
        where: {
          OR: [
            { code: voucherCode },
            { pin: pin },
            { serial: serial }
          ]
        }
      })

      if (existing) {
        return NextResponse.json({ 
          error: 'Voucher with this code, PIN, or serial already exists' 
        }, { status: 400 })
      }

      await prisma.voucher.create({
        data: {
          code: voucherCode,
          pin,
          serial,
          type,
          price: defaultPrice,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Voucher created successfully',
        count: 1
      })
    }

    // Otherwise, create multiple vouchers without PIN/serial
    if (quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 100' }, { status: 400 })
    }

    // Create vouchers
    const vouchers = []
    for (let i = 0; i < quantity; i++) {
      const voucherCode = generateVoucherCode(type)
      
      // Ensure code is unique
      const existing = await prisma.voucher.findUnique({ where: { code: voucherCode } })
      if (existing) {
        // Generate new code if collision
        const newCode = generateVoucherCode(type) + Math.random().toString(36).substring(2, 4).toUpperCase()
        vouchers.push({
          code: newCode,
          type,
          price: defaultPrice,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        })
      } else {
        vouchers.push({
          code: voucherCode,
          type,
          price: defaultPrice,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        })
      }
    }

    // Bulk create vouchers
    await prisma.voucher.createMany({
      data: vouchers
    })

    return NextResponse.json({ 
      success: true, 
      message: `${quantity} voucher(s) created successfully`,
      count: quantity
    })
  } catch (error) {
    console.error('Error creating vouchers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
