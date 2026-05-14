import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  validatePurchaseInput,
  processVoucherPurchase,
  type PurchaseVoucherInput
} from '@/lib/voucher-purchase'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to purchase vouchers' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { type, quantity = 1, paymentMethod = 'wallet', phoneNumber } = body

    // Validate input
    const validationErrors = validatePurchaseInput(type, quantity, phoneNumber)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validationErrors,
          message: validationErrors.map(e => e.message).join(', ')
        },
        { status: 400 }
      )
    }

    // Only wallet payment is supported for now
    if (paymentMethod !== 'wallet') {
      return NextResponse.json(
        {
          error: 'Payment method not supported',
          message: 'Only wallet payment is currently supported'
        },
        { status: 400 }
      )
    }

    // Process purchase
    try {
      const result = await processVoucherPurchase({
        userId: session.user.id,
        type: type as 'BECE' | 'WASSCE',
        quantity: parseInt(quantity),
        phoneNumber: phoneNumber?.trim()
      })

      // Build success message
      let message = `Successfully purchased ${quantity} ${type} voucher(s)`
      if (result.smsSent) {
        message += '. SMS sent successfully.'
      } else if (result.smsError) {
        message += `. SMS delivery failed: ${result.smsError}`
      } else if (!phoneNumber) {
        message += '.'
      }

      return NextResponse.json({
        success: true,
        message,
        vouchers: result.vouchers,
        totalCost: result.totalCost,
        reference: result.reference,
        newBalance: result.newBalance,
        phoneNumber: phoneNumber?.trim() || null,
        smsSent: result.smsSent,
        smsError: result.smsError || null
      })
    } catch (error) {
      // Handle known errors
      if (error instanceof Error) {
        const errorMessage = error.message

        // Check for specific error types
        if (errorMessage.includes('Insufficient wallet balance')) {
          return NextResponse.json(
            {
              error: 'Insufficient wallet balance',
              message: errorMessage
            },
            { status: 400 }
          )
        }

        if (errorMessage.includes('Only') && errorMessage.includes('vouchers available')) {
          return NextResponse.json(
            {
              error: 'Insufficient vouchers',
              message: errorMessage
            },
            { status: 400 }
          )
        }

        if (errorMessage.includes('User not found')) {
          return NextResponse.json(
            {
              error: 'User not found',
              message: 'Your account could not be found. Please try signing in again.'
            },
            { status: 404 }
          )
        }

        // Generic error
        return NextResponse.json(
          {
            error: 'Purchase failed',
            message: errorMessage
          },
          { status: 400 }
        )
      }

      // Unknown error
      throw error
    }
  } catch (error) {
    console.error('Error purchasing vouchers:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    )
  }
}
