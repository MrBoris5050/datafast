import nodemailer from 'nodemailer'

// SMTP Configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 10000, // 10 seconds
    pool: true, // Use connection pooling
    maxConnections: 1,
    maxMessages: 3,
  })
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('SMTP not configured, logging email instead:')
      console.log(`To: ${to}`)
      console.log(`Subject: ${subject}`)
      console.log(`Content: ${text || html}`)
      return true
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: `"datafast" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    const result = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', result.messageId)
    return true
  } catch (error: any) {
    console.error('Failed to send email:', error.message || error)
    
    // In development, log the email instead of failing completely
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Logging email instead of sending:')
      console.log(`To: ${to}`)
      console.log(`Subject: ${subject}`)
      console.log(`Content: ${text || html.replace(/<[^>]*>/g, '')}`)
      return true
    }
    
    return false
  }
}

export function generatePasswordResetEmail(code: string, email: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - datafast</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: inline-block;
          margin-bottom: 16px;
        }
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 12px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .subtitle {
          color: #6b7280;
          margin: 8px 0 0 0;
        }
        .code-container {
          background: #f3f4f6;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          color: #1f2937;
          letter-spacing: 4px;
          font-family: 'Courier New', monospace;
        }
        .code-label {
          color: #6b7280;
          font-size: 14px;
          margin-top: 8px;
        }
        .instructions {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 16px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        .footer {
          text-align: center;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/logo.jpg" alt="datafast Logo" />
          </div>
          <h1 class="title">Password Reset Request</h1>
          <p class="subtitle">We received a request to reset your password</p>
        </div>

        <div class="code-container">
          <div class="code">${code}</div>
          <div class="code-label">Your verification code</div>
        </div>

        <div class="instructions">
          <strong>How to use this code:</strong>
          <ol>
            <li>Return to the datafast login page</li>
            <li>Enter this 6-digit code when prompted</li>
            <li>Create your new password</li>
          </ol>
        </div>

        <div class="warning">
          <strong>Security Notice:</strong><br>
          • This code expires in 10 minutes<br>
          • Only use this code if you requested a password reset<br>
          • Never share this code with anyone<br>
          • If you didn't request this, please ignore this email
        </div>

        <div class="footer">
          <p>This email was sent to <strong>${email}</strong></p>
          <p>If you have any questions, please contact our support team.</p>
          <p>&copy; 2024 datafast. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
datafast - Password Reset Request

Your verification code: ${code}

How to use this code:
1. Return to the datafast login page
2. Enter this 6-digit code when prompted
3. Create your new password

Security Notice:
- This code expires in 10 minutes
- Only use this code if you requested a password reset
- Never share this code with anyone
- If you didn't request this, please ignore this email

This email was sent to ${email}
If you have any questions, please contact our support team.

© 2024 datafast. All rights reserved.
  `

  return { html, text }
}

export function generateWelcomeEmail(name: string, email: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to datafast</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: inline-block;
          margin-bottom: 16px;
        }
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 12px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .subtitle {
          color: #6b7280;
          margin: 8px 0 0 0;
        }
        .welcome-message {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        .features {
          margin: 24px 0;
        }
        .feature-item {
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .feature-item:last-child {
          border-bottom: none;
        }
        .feature-icon {
          display: inline-block;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 50%;
          color: white;
          text-align: center;
          line-height: 24px;
          margin-right: 12px;
          font-weight: bold;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 16px 0;
          text-align: center;
        }
        .button-container {
          text-align: center;
          margin: 24px 0;
        }
        .footer {
          text-align: center;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/logo.jpg" alt="datafast Logo" />
          </div>
          <h1 class="title">Welcome to datafast!</h1>
          <p class="subtitle">Your account has been successfully created</p>
        </div>

        <div class="welcome-message">
          <p style="margin: 0; font-size: 16px;">
            Hi <strong>${name}</strong>,
          </p>
          <p style="margin: 12px 0 0 0;">
            Thank you for joining datafast! We're excited to have you on board. Your account has been successfully created and you can now start using our platform.
          </p>
        </div>

        <div class="features">
          <h3 style="color: #1f2937; margin-bottom: 16px;">What you can do:</h3>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <strong>Access your dashboard</strong> - Manage your account and view your activity
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <strong>Browse products</strong> - Explore our wide range of inventory
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <strong>Place orders</strong> - Start purchasing products right away
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <strong>Track your orders</strong> - Monitor your purchases in real-time
          </div>
        </div>

        <div class="button-container">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signin" class="button">
            Sign In to Your Account
          </a>
        </div>

        <div class="footer">
          <p>This email was sent to <strong>${email}</strong></p>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>&copy; 2024 datafast. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
datafast - Welcome!

Hi ${name},

Thank you for joining datafast! We're excited to have you on board. Your account has been successfully created and you can now start using our platform.

What you can do:
✓ Access your dashboard - Manage your account and view your activity
✓ Browse products - Explore our wide range of inventory
✓ Place orders - Start purchasing products right away
✓ Track your orders - Monitor your purchases in real-time

Sign in to your account: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signin

This email was sent to ${email}
If you have any questions or need assistance, please don't hesitate to contact our support team.

© 2024 datafast. All rights reserved.
  `

  return { html, text }
}
