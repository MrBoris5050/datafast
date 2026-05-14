import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Consistent date formatting for client-side (prevents hydration mismatches)
export function formatDateSafe(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Consistent date-time formatting for client-side (prevents hydration mismatches)
export function formatDateTimeSafe(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// Consistent number formatting (prevents hydration mismatches)
export function formatNumberSafe(num: number): string {
  return num.toLocaleString('en-US')
}

export function generateReference(): string {
  return `DLT_ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^(\+233|233|0)?[2-9]\d{8}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('233')) {
    return `+${cleaned}`
  } else if (cleaned.startsWith('0')) {
    return `+233${cleaned.substring(1)}`
  } else if (cleaned.length === 10 && cleaned.startsWith('2')) {
    return `+233${cleaned}`
  }
  return phone
}

// Format network name for display in UI
export function formatNetworkName(network: string): string {
  if (network === 'AT ISHARE') {
    return 'AirtelTigo - iShare'
  }
  return network
}