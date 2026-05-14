import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { sendSmsViaArkesel } from '@/lib/arkesel'

// Verify Paystack webhook signature
function verifyPaystackSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify webhook signature
    const signature = request.headers.get('x-paystack-signature')
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    if (!signature) {
      console.error('Missing Paystack signature')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    const isValid = verifyPaystackSignature(rawBody, signature, paystackSecretKey)
    if (!isValid) {
      console.error('Invalid Paystack webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Extract event data
    const event = body.event // e.g., "charge.success", "charge.failed"
    const transactionData = body.data

    console.log('Paystack webhook received:', {
      event,
      reference: transactionData?.reference,
      status: transactionData?.status,
      amount: transactionData?.amount,
      metadata: transactionData?.metadata
    })

    // Handle successful charge events
    if (event === 'charge.success') {
      const reference = transactionData?.reference
      const metadata = transactionData?.metadata || {}
      const amount = transactionData?.amount // Amount in kobo (divide by 100 to get actual amount)
      const status = transactionData?.status

      if (!reference) {
        console.error('No reference found in webhook payload')
        return NextResponse.json(
          { error: 'Missing reference' },
          { status: 400 }
        )
      }

      // Check if this is a wallet topup
      if (metadata.kind === 'WALLET_TOPUP') {
        // Find the transaction
        const transaction = await prisma.transaction.findUnique({
          where: { reference }
        })

        if (!transaction) {
          console.warn('Transaction not found for reference:', reference)
          // Return 200 to acknowledge webhook even if transaction not found
          return NextResponse.json({ received: true, message: 'Transaction not found' })
        }

        // Only process if transaction is still pending
        if (transaction.status === 'COMPLETED') {
          console.log(`Transaction ${reference} already processed`)
          return NextResponse.json({ 
            received: true, 
            message: 'Transaction already processed' 
          })
        }

        // Verify payment status from Paystack
        if (status !== 'success') {
          console.warn(`Transaction ${reference} status is not success:`, status)
          return NextResponse.json({ 
            received: true, 
            message: 'Transaction not successful' 
          })
        }

        // Credit wallet and update transaction
        // IMPORTANT: Use Paystack's actual amount to calculate baseAmount
        // Paystack amount is in kobo and includes the 2% fee
        // We divide by 100 to convert kobo to GHS, then divide by 1.02 to remove the 2% fee
        const paystackAmountKobo = transactionData?.amount || 0
        const paystackAmountGHS = paystackAmountKobo / 100
        const baseAmount = paystackAmountGHS / 1.02 // Remove 2% fee to get base amount
        
        // Log for debugging
        console.log(`Processing topup ${reference}:`, {
          paystackAmountKobo,
          paystackAmountGHS,
          baseAmount,
          fee: paystackAmountGHS - baseAmount,
          feePercent: ((paystackAmountGHS - baseAmount) / baseAmount * 100).toFixed(2) + '%'
        })

        await prisma.$transaction(async (tx) => {
          // Update transaction status and amount to match what we're crediting
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { 
              status: 'COMPLETED',
              amount: baseAmount // Update to match the actual credited amount
            }
          })

          // Credit wallet with baseAmount (calculated from Paystack amount minus 2% fee)
          await tx.user.update({
            where: { id: transaction.userId },
            data: { walletBalance: { increment: baseAmount } }
          })
        })

        // Send SMS notification
        const user = await prisma.user.findUnique({
          where: { id: transaction.userId },
          select: { phone: true, walletBalance: true }
        })

        if (user?.phone) {
          // Use the same baseAmount calculated above
          const formattedAmount = baseAmount.toFixed(2)
          const formattedBalance = Number(user.walletBalance).toFixed(2)
          const msg = `Your datafast wallet has been credited with GHS ${formattedAmount}. Ref: ${reference}. New balance: GHS ${formattedBalance}`
          
          sendSmsViaArkesel({ to: user.phone, message: msg }).catch(err => {
            console.error('SMS send error:', err)
          })
        }

        console.log(`Wallet topup completed for transaction ${reference}`)

        return NextResponse.json({
          success: true,
          message: 'Webhook processed',
          reference,
          event
        })
      } else if (metadata.kind === 'AGENT_UPGRADE') {
        const transaction = await prisma.transaction.findUnique({ where: { reference } })

        if (!transaction) {
          console.warn('Agent upgrade transaction not found:', reference)
          return NextResponse.json({ received: true, message: 'Transaction not found' })
        }

        if (transaction.status === 'COMPLETED') {
          console.log(`Agent upgrade ${reference} already processed`)
          return NextResponse.json({ received: true, message: 'Already processed' })
        }

        if (status !== 'success') {
          await prisma.transaction.updateMany({
            where: { reference, status: 'PENDING' },
            data: { status: 'FAILED' }
          })
          return NextResponse.json({ received: true, message: 'Payment not successful' })
        }

        const currentUser = await prisma.user.findUnique({
          where: { id: transaction.userId },
          select: { role: true }
        })

        await prisma.$transaction([
          ...(currentUser?.role === 'CUSTOMER'
            ? [prisma.user.update({ where: { id: transaction.userId }, data: { role: 'AGENT' } })]
            : []),
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' }
          })
        ])

        console.log(`Agent upgrade completed via webhook for ${reference}`)
        return NextResponse.json({ success: true, message: 'Agent upgrade processed' })
      } else {
        // Handle other payment types
        console.log('Non-topup payment webhook received:', reference)
        return NextResponse.json({
          received: true,
          message: 'Non-topup payment (not processed)'
        })
      }
    } else if (event === 'charge.failed') {
      // Handle failed charges
      const reference = transactionData?.reference
      const metadata = transactionData?.metadata || {}

      if ((metadata.kind === 'WALLET_TOPUP' || metadata.kind === 'AGENT_UPGRADE') && reference) {
        // Update transaction status to failed
        await prisma.transaction.updateMany({
          where: {
            reference,
            status: 'PENDING'
          },
          data: { status: 'FAILED' }
        })

        console.log(`${metadata.kind} payment failed for transaction ${reference}`)
      }

      return NextResponse.json({
        received: true,
        message: 'Failed charge processed'
      })
    } else {
      // Acknowledge other events but don't process them
      console.log('Unhandled Paystack event:', event)
      return NextResponse.json({
        received: true,
        message: `Event ${event} acknowledged but not processed`
      })
    }
  } catch (error: any) {
    console.error('Paystack webhook processing error:', error)
    // Return 200 to prevent webhook retries for processing errors
    // Paystack will retry if we return an error status
    return NextResponse.json(
      { error: error?.message || 'Webhook processing failed' },
      { status: 200 }
    )
  }
}

// Allow GET for webhook verification/health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Paystack webhook endpoint is active'
  })
}

