/**
 * SMS Service - Wrapper for Arkessel SMS Integration
 * Uses the existing arkesel.ts implementation
 * 
 * Required Environment Variables:
 * - ARKESSEL_API_KEY: Your Arkessel API key
 * - ARKESSEL_SENDER_ID: Sender ID (max 11 characters, e.g., "datafast")
 */

import { sendSmsViaArkesel } from './arkesel'

interface SMSOptions {
  to: string
  message: string
  senderId?: string
}

export async function sendSMS({ to, message, senderId }: SMSOptions): Promise<boolean> {
  const result = await sendSmsViaArkesel({ to, message, senderId })
  return result.ok
}

// Generate password reset SMS message
export function generatePasswordResetSMS(code: string): string {
  return `Your datafast password reset code is: ${code}. This code expires in 10 minutes. Do not share this code with anyone.`
}

// Generate OTP verification SMS message  
export function generateOTPSMS(code: string): string {
  return `Your datafast verification code is: ${code}. Valid for 10 minutes.`
}

// Generate welcome SMS message for new registrations
export function generateWelcomeSMS(name: string): string {
  return `Welcome to datafast, ${name}! Your account has been successfully created. You can now sign in and start using our platform. Thank you for joining us!`
}
