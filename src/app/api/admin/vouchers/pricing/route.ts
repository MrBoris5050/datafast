import { NextRequest, NextResponse } from 'next/server'
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

    // Fetch voucher pricing
    const pricing = await prisma.voucherPricing.findMany({
      orderBy: { type: 'asc' }
    })

    // Ensure both types exist with default prices
    const becePricing = pricing.find(p => p.type === 'BECE')
    const wasscePricing = pricing.find(p => p.type === 'WASSCE')

    // Create default pricing if not exists
    if (!becePricing) {
      await prisma.voucherPricing.create({
        data: {
          type: 'BECE',
          price: 5.00
        }
      })
    }

    if (!wasscePricing) {
      await prisma.voucherPricing.create({
        data: {
          type: 'WASSCE',
          price: 10.00
        }
      })
    }

    // Fetch again to get all pricing
    const allPricing = await prisma.voucherPricing.findMany({
      orderBy: { type: 'asc' }
    })

    return NextResponse.json({ pricing: allPricing })
  } catch (error) {
    console.error('Error fetching voucher pricing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const { type, price } = await request.json()

    if (!type || !['BECE', 'WASSCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 })
    }

    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 })
    }

    // Update or create pricing
    const pricing = await prisma.voucherPricing.upsert({
      where: { type },
      update: {
        price: parseFloat(price)
      },
      create: {
        type: type as 'BECE' | 'WASSCE',
        price: parseFloat(price)
      }
    })

    return NextResponse.json({
      success: true,
      message: `${type} voucher price updated successfully`,
      pricing
    })
  } catch (error) {
    console.error('Error updating voucher pricing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




