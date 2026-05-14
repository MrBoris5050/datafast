import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { paystack } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()
    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    // Find the transaction first to check if already processed
    const tx = await prisma.transaction.findUnique({ where: { reference } })
    if (!tx || tx.type !== 'TOPUP') {
      return NextResponse.json({ error: 'Top-up transaction not found' }, { status: 404 })
    }

    // Check if transaction is already completed to prevent double processing
    // If webhook already processed it, return success immediately
    if (tx.status === 'COMPLETED') {
      return NextResponse.json({ 
        success: true,
        message: 'Transaction already processed',
        creditedAmount: Number(tx.amount),
        alreadyProcessed: true
      })
    }

    // Verify payment with Paystack (only if not already completed)
    const verify = await paystack.verifyPayment(reference)
    if (!verify.status) {
      // If Paystack verification fails, check again if webhook processed it in the meantime
      const txCheck = await prisma.transaction.findUnique({ where: { reference } })
      if (txCheck?.status === 'COMPLETED') {
        return NextResponse.json({ 
          success: true,
          message: 'Transaction already processed',
          creditedAmount: Number(txCheck.amount),
          alreadyProcessed: true
        })
      }
      return NextResponse.json({ error: verify.message }, { status: 400 })
    }

    // Extract payment data from Paystack response
    const paymentData = verify.data as any
    if (!paymentData) {
      // If Paystack response is invalid, check again if webhook processed it
      const txCheck = await prisma.transaction.findUnique({ where: { reference } })
      if (txCheck?.status === 'COMPLETED') {
        return NextResponse.json({ 
          success: true,
          message: 'Transaction already processed',
          creditedAmount: Number(txCheck.amount),
          alreadyProcessed: true
        })
      }
      return NextResponse.json({ error: 'Invalid verification response' }, { status: 400 })
    }

    // Check payment status
    if (paymentData.status !== 'success') {
      // If payment status is not success, check again if webhook processed it
      const txCheck = await prisma.transaction.findUnique({ where: { reference } })
      if (txCheck?.status === 'COMPLETED') {
        return NextResponse.json({ 
          success: true,
          message: 'Transaction already processed',
          creditedAmount: Number(txCheck.amount),
          alreadyProcessed: true
        })
      }
      return NextResponse.json({ error: 'Payment was not successful' }, { status: 400 })
    }

    // Validate amount from Paystack
    // Paystack amount is in kobo (for NGN) or pesewas (for GHS), divide by 100 to get actual amount
    const paystackAmountKobo = paymentData.amount || 0
    const paystackAmountActual = paystackAmountKobo / 100
    
    // Calculate expected amount with 2% fee (same logic as initialization)
    const expectedChargeAmount = Number(tx.amount) * 1.02
    
    // Allow small tolerance for floating point precision (0.01 currency units)
    const tolerance = 0.01
    if (Math.abs(paystackAmountActual - expectedChargeAmount) > tolerance) {
      console.error(`Amount mismatch for ${reference}:`, {
        paystackAmount: paystackAmountActual,
        expectedAmount: expectedChargeAmount,
        originalAmount: tx.amount,
        difference: Math.abs(paystackAmountActual - expectedChargeAmount)
      })
      return NextResponse.json({ 
        error: 'Payment amount does not match expected amount' 
      }, { status: 400 })
    }

    // Calculate the base amount to credit (remove the 2% fee)
    const baseAmountToCredit = paystackAmountActual / 1.02

    // Log for debugging
    console.log(`Processing manual topup verification ${reference}:`, {
      paystackAmountKobo,
      paystackAmountActual,
      expectedChargeAmount,
      baseAmountToCredit,
      originalTxAmount: tx.amount,
      fee: paystackAmountActual - baseAmountToCredit
    })

    await prisma.$transaction(async (db) => {
      // Update transaction status and amount to match what we're crediting
      await db.transaction.update({
        where: { id: tx.id },
        data: { 
          status: 'COMPLETED',
          amount: baseAmountToCredit // Update to match the actual credited amount
        },
      })

      // Credit wallet with the validated base amount (excluding fee)
      await db.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: baseAmountToCredit } },
      })
    })

    return NextResponse.json({ 
      success: true,
      creditedAmount: baseAmountToCredit
    })
  } catch (error) {
    console.error('Wallet topup verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


