import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

export async function POST(request: NextRequest) {
  try {
    const { identifier, code } = await request.json()

    if (!identifier || !code) {
      return NextResponse.json(
        { error: 'Email/phone and code are required' },
        { status: 400 }
      )
    }

    // Detect if identifier is email or phone and normalize email to lowercase
    const identifierType = detectIdentifierType(identifier)
    const normalizedIdentifier = identifierType === 'email' 
      ? identifier.trim().toLowerCase() 
      : identifier.trim()

    // Find reset code in database (check both email and phone methods)
    const resetData = await prisma.passwordReset.findFirst({
      where: {
        identifier: normalizedIdentifier,
        code,
        used: false
      }
    })

    if (!resetData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset code' },
        { status: 400 }
      )
    }

    // Check if code has expired
    if (new Date() > resetData.expiresAt) {
      // Clean up expired code
      await prisma.passwordReset.delete({
        where: { id: resetData.id }
      })
      return NextResponse.json(
        { error: 'Reset code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Reset code verified successfully'
    })

  } catch (error) {
    console.error('Verify reset code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
