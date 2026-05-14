import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail, generatePasswordResetEmail } from '@/lib/email'

export async function POST(request: Request) {
  // Only allow admins to test email functionality
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Generate a test reset email
    const testCode = '123456'
    const { html, text } = generatePasswordResetEmail(testCode, email)

    const success = await sendEmail({
      to: email,
      subject: 'Test Email - datafast SMTP Configuration',
      html,
      text
    })

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
        testCode
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send test email' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




