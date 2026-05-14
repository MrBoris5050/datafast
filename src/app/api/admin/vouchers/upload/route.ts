import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getVoucherPrice } from '@/lib/voucher-pricing'

// Generate unique voucher code if not provided
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!type || !['BECE', 'WASSCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 })
    }

    // Get default price for voucher type
    const defaultPrice = await getVoucherPrice(type as 'BECE' | 'WASSCE')

    // Read file content
    const fileContent = await file.text()
    const lines = fileContent.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'File must contain at least a header row and one data row' }, { status: 400 })
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const pinIndex = headers.findIndex(h => h.includes('pin'))
    const serialIndex = headers.findIndex(h => h.includes('serial'))
    const codeIndex = headers.findIndex(h => h.includes('code'))

    if (pinIndex === -1 || serialIndex === -1) {
      return NextResponse.json({ 
        error: 'CSV must contain "pin" and "serial" columns' 
      }, { status: 400 })
    }

    const vouchers: Array<{
      code: string
      pin: string
      serial: string
      type: 'BECE' | 'WASSCE'
      price: number
    }> = []
    const errors: string[] = []
    const duplicates: string[] = []

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim())
      
      if (row.length < Math.max(pinIndex, serialIndex) + 1) {
        errors.push(`Row ${i + 1}: Insufficient columns`)
        continue
      }

      const pin = row[pinIndex]
      const serial = row[serialIndex]
      const code = codeIndex >= 0 ? row[codeIndex] : null

      if (!pin || !serial) {
        errors.push(`Row ${i + 1}: Missing PIN or Serial`)
        continue
      }

      // Check for duplicates in the file
      const duplicateInFile = vouchers.find(v => v.pin === pin || v.serial === serial)
      if (duplicateInFile) {
        duplicates.push(`Row ${i + 1}: Duplicate PIN or Serial in file`)
        continue
      }

      // Check for existing vouchers in database
      const existing = await prisma.voucher.findFirst({
        where: {
          OR: [
            { pin: pin },
            { serial: serial },
            ...(code ? [{ code: code }] : [])
          ]
        }
      })

      if (existing) {
        duplicates.push(`Row ${i + 1}: Voucher with PIN ${pin} or Serial ${serial} already exists in database`)
        continue
      }

      vouchers.push({
        code: code || generateVoucherCode(type as 'BECE' | 'WASSCE'),
        pin,
        serial,
        type: type as 'BECE' | 'WASSCE',
        price: defaultPrice
      })
    }

    if (vouchers.length === 0) {
      return NextResponse.json({ 
        error: 'No valid vouchers to upload',
        errors,
        duplicates
      }, { status: 400 })
    }

    // Create vouchers in batches
    const batchSize = 100
    let created = 0
    const createErrors: string[] = []

    for (let i = 0; i < vouchers.length; i += batchSize) {
      const batch = vouchers.slice(i, i + batchSize)
      try {
        await prisma.voucher.createMany({
          data: batch,
          skipDuplicates: true
        })
        created += batch.length
      } catch (error: any) {
        createErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${created} voucher(s)`,
      created,
      total: vouchers.length,
      errors: errors.length > 0 ? errors : undefined,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      createErrors: createErrors.length > 0 ? createErrors : undefined
    })
  } catch (error: any) {
    console.error('Error uploading vouchers:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

