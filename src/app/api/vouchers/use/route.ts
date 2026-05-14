import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { voucherCode, indexNumber, year, type } = await request.json()

    if (!voucherCode || !indexNumber || !year || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['BECE', 'WASSCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 })
    }

    // Find the voucher
    const voucher = await prisma.voucher.findUnique({
      where: { code: voucherCode },
      include: { user: true }
    })

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    // Validate voucher
    if (voucher.type !== type) {
      return NextResponse.json({ error: `This voucher is for ${voucher.type}, not ${type}` }, { status: 400 })
    }

    if (voucher.userId !== session.user.id) {
      return NextResponse.json({ error: 'This voucher does not belong to you' }, { status: 403 })
    }

    if (voucher.isUsed) {
      return NextResponse.json({ error: 'This voucher has already been used' }, { status: 400 })
    }

    if (!voucher.isActive) {
      return NextResponse.json({ error: 'This voucher is not active' }, { status: 400 })
    }

    // Check expiry
    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This voucher has expired' }, { status: 400 })
    }

    // Mark voucher as used
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    })

    // Here you would integrate with the actual BECE/WASSCE results API
    // For now, we'll return a success response with demo data
    const demoResult = {
      indexNumber,
      year,
      type,
      studentName: 'Demo Student',
      school: 'Demo School',
      results: type === 'BECE' ? [
        { subject: 'English Language', grade: 'A' },
        { subject: 'Mathematics', grade: 'B' },
        { subject: 'Science', grade: 'A' },
        { subject: 'Social Studies', grade: 'B' }
      ] : [
        { subject: 'English Language', grade: 'A1' },
        { subject: 'Mathematics (Core)', grade: 'B2' },
        { subject: 'Physics', grade: 'A1' },
        { subject: 'Chemistry', grade: 'B3' },
        { subject: 'Biology', grade: 'A1' }
      ]
    }

    return NextResponse.json({
      success: true,
      message: 'Results retrieved successfully',
      voucherUsed: true,
      result: demoResult
    })
  } catch (error) {
    console.error('Error using voucher:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



