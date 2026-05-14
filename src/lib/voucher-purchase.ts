import { prisma } from '@/lib/db'
import { generateReference } from '@/lib/paystack'
import { sendSmsViaArkesel } from '@/lib/arkesel'
import { VoucherType } from '@prisma/client'

export interface PurchaseVoucherInput {
  userId: string
  type: VoucherType
  quantity: number
  phoneNumber?: string
}

export interface PurchaseVoucherResult {
  success: boolean
  vouchers: Array<{
    id: string
    code: string
    pin?: string | null
    serial?: string | null
    type: VoucherType
    price: number
    createdAt: Date
  }>
  totalCost: number
  reference: string
  newBalance: number
  smsSent: boolean
  smsError?: string | null
}

export interface ValidationError {
  field: string
  message: string
}

/**
 * Validate purchase input
 */
export function validatePurchaseInput(
  type: string,
  quantity: number,
  phoneNumber?: string
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!type || !['BECE', 'WASSCE'].includes(type)) {
    errors.push({ field: 'type', message: 'Invalid voucher type. Must be BECE or WASSCE' })
  }

  if (!quantity || quantity < 1 || quantity > 10) {
    errors.push({ field: 'quantity', message: 'Quantity must be between 1 and 10' })
  }

  if (phoneNumber && !/^0\d{9}$/.test(phoneNumber.trim())) {
    errors.push({ field: 'phoneNumber', message: 'Invalid phone number format. Use format: 0549664205' })
  }

  return errors
}

/**
 * Find available vouchers for purchase
 */
export async function findAvailableVouchers(
  type: VoucherType,
  quantity: number
) {
  const vouchers = await prisma.voucher.findMany({
    where: {
      type,
      isActive: true,
      isUsed: false,
      userId: null, // Not yet assigned to any user
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    take: quantity,
    orderBy: { createdAt: 'asc' }
  })

  return vouchers
}

/**
 * Calculate total cost for vouchers
 */
export function calculateTotalCost(vouchers: Array<{ price: number | any }>): number {
  return vouchers.reduce((sum, voucher) => sum + Number(voucher.price), 0)
}

/**
 * Process voucher purchase transaction
 */
export async function processVoucherPurchase(
  input: PurchaseVoucherInput
): Promise<PurchaseVoucherResult> {
  const { userId, type, quantity, phoneNumber } = input

  // Find available vouchers
  const availableVouchers = await findAvailableVouchers(type, quantity)

  if (availableVouchers.length < quantity) {
    throw new Error(`Only ${availableVouchers.length} ${type} vouchers available`)
  }

  // Calculate total cost
  const totalCost = calculateTotalCost(availableVouchers)

  // Get user with fresh balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Check wallet balance
  const balance = Number(user.walletBalance || 0)
  if (balance < totalCost) {
    throw new Error(`Insufficient wallet balance. Required: ₵${totalCost.toFixed(2)}, Available: ₵${balance.toFixed(2)}`)
  }

  // Generate reference
  const reference = generateReference()

  // Process transaction
  await prisma.$transaction(async (tx) => {
    // Deduct from wallet
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: totalCost } }
    })

    // Assign vouchers to user
    await tx.voucher.updateMany({
      where: {
        id: { in: availableVouchers.map(v => v.id) }
      },
      data: { userId }
    })

    // Create purchase records
    for (const voucher of availableVouchers) {
      await tx.voucherPurchase.create({
        data: {
          userId,
          voucherId: voucher.id,
          amount: voucher.price,
          status: 'COMPLETED',
          reference: `${reference}_${voucher.id.slice(-4)}`,
          method: 'wallet',
          phoneNumber: phoneNumber?.trim() || null
        }
      })
    }

    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        type: 'PURCHASE',
        amount: totalCost,
        description: `Purchase of ${quantity} ${type} voucher(s)`,
        reference,
        status: 'COMPLETED'
      }
    })
  })

  // Fetch updated vouchers with details
  const purchasedVouchers = await prisma.voucher.findMany({
    where: {
      id: { in: availableVouchers.map(v => v.id) }
    },
    select: {
      id: true,
      code: true,
      pin: true,
      serial: true,
      type: true,
      price: true,
      createdAt: true
    }
  })

  // Get updated user balance
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true }
  })

  // Send SMS if phone number provided
  let smsSent = false
  let smsError: string | null = null

  if (phoneNumber && purchasedVouchers.length > 0) {
    const smsResult = await sendVoucherSMS(
      type,
      purchasedVouchers,
      phoneNumber.trim()
    )
    smsSent = smsResult.sent
    smsError = smsResult.error || null
  }

  return {
    success: true,
    vouchers: purchasedVouchers.map(v => ({
      ...v,
      price: Number(v.price)
    })),
    totalCost,
    reference,
    newBalance: updatedUser ? Number(updatedUser.walletBalance) : 0,
    smsSent,
    smsError
  }
}

/**
 * Send voucher details via SMS
 */
async function sendVoucherSMS(
  type: VoucherType,
  vouchers: Array<{ serial?: string | null; pin?: string | null }>,
  phoneNumber: string
): Promise<{ sent: boolean; error?: string }> {
  const url = type === 'WASSCE' ? 'ghana.waecdirect.org' : 'eresults.waecgh.org'
  
  // Filter vouchers with PIN and Serial
  const vouchersWithDetails = vouchers.filter(v => v.pin && v.serial)
  
  if (vouchersWithDetails.length === 0) {
    return { sent: false, error: 'No vouchers with PIN and Serial found' }
  }

  try {
    // Batch vouchers into groups of 10
    const batchSize = 10
    const batches: typeof vouchersWithDetails[] = []
    
    for (let i = 0; i < vouchersWithDetails.length; i += batchSize) {
      batches.push(vouchersWithDetails.slice(i, i + batchSize))
    }
    
    // Send one SMS per batch
    let allSent = true
    let lastError: string | null = null

    for (const batch of batches) {
      // Build SMS message with all vouchers in the batch
      const voucherLines = batch.map(v => 
        `Serial: ${v.serial} - Pin: ${v.pin}`
      ).join('\n')
      
      const smsMessage = `${type} Checker\n\n${voucherLines}\n\n${url}`
      
      const smsResult = await sendSmsViaArkesel({
        to: phoneNumber,
        message: smsMessage
      })
      
      if (!smsResult.ok) {
        allSent = false
        lastError = smsResult.error || 'SMS sending failed'
        console.error('SMS sending failed for batch:', lastError)
      }
    }

    return {
      sent: allSent,
      error: lastError || undefined
    }
  } catch (error) {
    console.error('Error sending voucher SMS:', error)
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

