import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail, generatePasswordResetEmail } from '@/lib/email'
import { sendSMS, generatePasswordResetSMS } from '@/lib/sms'

// Generate a 6-digit random code
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Detect if identifier is email or phone
function detectIdentifierType(identifier: string): 'email' | 'phone' {
  // Simple email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(identifier)) {
    return 'email'
  }
  // If it contains only digits and possibly +, spaces, or dashes, treat as phone
  const phoneRegex = /^[\d\s\+\-\(\)]+$/
  if (phoneRegex.test(identifier) && identifier.replace(/\D/g, '').length >= 7) {
    return 'phone'
  }
  // Default to email if unclear
  return 'email'
}

// Send password reset SMS via Arkessel
async function sendPasswordResetSMS(phone: string, code: string): Promise<boolean> {
  try {
    const message = generatePasswordResetSMS(code)
    return await sendSMS({
      to: phone,
      message,
    })
  } catch (error) {
    console.error('Failed to send password reset SMS:', error)
    return false
  }
}

// Send password reset email via custom SMTP
async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  try {
    const { html, text } = generatePasswordResetEmail(code, email)
    
    return await sendEmail({
      to: email,
      subject: 'Password Reset Code - datafast',
      html,
      text
    })
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json()

    if (!identifier) {
      return NextResponse.json(
        { error: 'Email or phone number is required' },
        { status: 400 }
      )
    }

    // Detect if identifier is email or phone
    const identifierType = detectIdentifierType(identifier)

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedIdentifier = identifierType === 'email' 
      ? identifier.trim().toLowerCase() 
      : identifier.trim()

    // Find user by email or phone
    const whereClause = identifierType === 'email' 
      ? { email: normalizedIdentifier }
      : { phone: normalizedIdentifier }

    const user = await prisma.user.findUnique({
      where: whereClause
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email or phone number' },
        { status: 404 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      )
    }

    // Generate reset code
    const code = generateResetCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Clean up any existing unused reset codes for this user
    await prisma.passwordReset.deleteMany({
      where: {
        userId: user.id,
        used: false
      }
    })

    // Store reset code in database (store for both email and phone if available)
    const resetRecords = []
    
    // Always store with the normalized identifier used to find the user
    resetRecords.push({
      userId: user.id,
      method: identifierType,
      identifier: normalizedIdentifier,
      code,
      expiresAt
    })

    // If user has both email and phone, also store for the other method
    if (user.email && user.phone && identifierType === 'email' && user.email === normalizedIdentifier) {
      resetRecords.push({
        userId: user.id,
        method: 'phone',
        identifier: user.phone,
        code,
        expiresAt
      })
    } else if (user.email && user.phone && identifierType === 'phone' && user.phone === normalizedIdentifier) {
      resetRecords.push({
        userId: user.id,
        method: 'email',
        identifier: user.email,
        code,
        expiresAt
      })
    }

    await prisma.passwordReset.createMany({
      data: resetRecords
    })

    // Send code to both email and phone if available
    const sendResults = []
    let sentTo = []

    if (user.email) {
      const emailSent = await sendPasswordResetEmail(user.email, code)
      sendResults.push(emailSent)
      if (emailSent) sentTo.push('email')
    }

    if (user.phone) {
      const smsSent = await sendPasswordResetSMS(user.phone, code)
      sendResults.push(smsSent)
      if (smsSent) sentTo.push('phone')
    }

    // If at least one method succeeded, consider it successful
    const atLeastOneSent = sendResults.some(result => result === true)

    if (!atLeastOneSent) {
      return NextResponse.json(
        { error: 'Failed to send reset code. Please try again later.' },
        { status: 500 }
      )
    }

    const sentMessage = sentTo.length === 2 
      ? 'Reset code sent to your email and phone'
      : `Reset code sent to your ${sentTo[0]}`

    return NextResponse.json({
      success: true,
      message: sentMessage,
      sentTo
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
