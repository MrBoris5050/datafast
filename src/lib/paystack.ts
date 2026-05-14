// Paystack integration utilities
export interface PaystackConfig {
  publicKey: string
  secretKey: string
}

export interface PaymentData {
  email: string
  amount: number
  reference: string
  callback_url?: string
  metadata?: Record<string, any>
}

export interface PaystackResponse {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export class PaystackService {
  private config: PaystackConfig

  constructor(config: PaystackConfig) {
    this.config = config
  }

  async initializePayment(paymentData: PaymentData): Promise<PaystackResponse> {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Paystack initialization error:', error)
      throw new Error('Failed to initialize payment')
    }
  }

  async verifyPayment(reference: string): Promise<PaystackResponse> {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
        },
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Paystack verification error:', error)
      throw new Error('Failed to verify payment')
    }
  }

  async createCustomer(email: string, firstName?: string, lastName?: string) {
    try {
      const response = await fetch('https://api.paystack.co/customer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Paystack customer creation error:', error)
      throw new Error('Failed to create customer')
    }
  }
}

// Initialize Paystack service
export const paystack = new PaystackService({
  publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
})

// Utility functions
export function formatAmount(amount: number): number {
  // Convert to kobo (multiply by 100) and ensure it's an integer
  return Math.round(amount * 100)
}

export function generateReference(): string {
  return `DLT_WALLET_${Date.now()}`
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^(\+233|233|0)?[2-9]\d{8}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}
