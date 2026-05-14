import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

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
    const { identifier, code, newPassword } = await request.json()

    if (!identifier || !code || !newPassword) {
      return NextResponse.json(
        { error: 'Email/phone, code, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Detect if identifier is email or phone and normalize email to lowercase
    const identifierType = detectIdentifierType(identifier)
    const normalizedIdentifier = identifierType === 'email' 
      ? identifier.trim().toLowerCase() 
      : identifier.trim()

    // Find and verify reset code
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

    // Get user from reset data
    const user = await prisma.user.findUnique({
      where: { id: resetData.userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Hash new password and update user
    const hashedPassword = hashPassword(newPassword)

    // Use transaction to update password and mark all reset codes for this user as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      }),
      prisma.passwordReset.updateMany({
        where: {
          userId: user.id,
          code,
          used: false
        },
        data: { used: true }
      })
    ])

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    })

  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
