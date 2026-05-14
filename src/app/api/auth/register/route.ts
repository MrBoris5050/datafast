import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { hashPassword } from '@/lib/password'
import { sendEmail, generateWelcomeEmail } from '@/lib/email'
import { sendSMS, generateWelcomeSMS } from '@/lib/sms'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone } = await request.json()

    // Validate required fields early
    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Normalize email to lowercase for case-insensitive storage and lookup
    const normalizedEmail = email.trim().toLowerCase()

    // Basic validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists (email and phone in parallel for speed)
    const [existingByEmail, existingByPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      phone ? prisma.user.findUnique({ where: { phone }, select: { id: true } }) : null
    ])

    if (existingByEmail) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    if (existingByPhone) {
      return NextResponse.json(
        { error: 'User with this phone number already exists' },
        { status: 400 }
      )
    }

    // Hash password and create user in one operation
    const hashedPassword = hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        role: 'CUSTOMER',
        isActive: true, // Explicitly set to true for immediate login capability
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true
      }
    })

    // Send welcome email and SMS to the user (non-blocking - don't fail registration if they fail)
    try {
      const { html, text } = generateWelcomeEmail(user.name || 'User', user.email)
      await sendEmail({
        to: user.email,
        subject: 'Welcome to datafast!',
        html,
        text
      })
    } catch (emailError) {
      // Log error but don't fail registration
      console.error('Failed to send welcome email:', emailError)
    }

    // Send welcome SMS
    try {
      if (user.phone) {
        const smsMessage = generateWelcomeSMS(user.name || 'User')
        await sendSMS({
          to: user.phone,
          message: smsMessage
        })
      }
    } catch (smsError) {
      // Log error but don't fail registration
      console.error('Failed to send welcome SMS:', smsError)
    }

    return NextResponse.json(
      { message: 'User created successfully', userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
