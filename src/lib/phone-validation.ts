/**
 * Phone number validation utility for Ghana phone numbers
 */

export interface PhoneValidationResult {
  valid: boolean
  normalized: string  // 10-digit local format: 0XXXXXXXXX (what VTU providers expect)
  international: string // International format: 233XXXXXXXXX (for SMS/notifications)
  error?: string
}

/**
 * Validate and normalize Ghana phone numbers
 * Accepts formats: 0XXXXXXXXX, 233XXXXXXXXX, +233XXXXXXXXX
 * Returns normalized format: 0XXXXXXXXX (10-digit local format for VTU providers)
 */
export function validateGhanaPhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', international: '', error: 'Phone number is required' }
  }

  // Remove spaces, dashes, and other common separators
  const cleaned = phone.replace(/[\s\-().]/g, '').trim()

  if (cleaned.length === 0) {
    return { valid: false, normalized: '', international: '', error: 'Phone number is required' }
  }

  // Valid prefixes for Ghana networks
  // 02X - MTN, Vodafone/Telecel, AirtelTigo
  // 03X - Some networks
  // 05X - MTN, Vodafone/Telecel, AirtelTigo
  const validPrefixes = ['20', '23', '24', '25', '26', '27', '28', '29', '50', '53', '54', '55', '56', '57', '59']

  // Pattern matching for different formats
  const patterns = [
    { regex: /^0([2-5][0-9])([0-9]{7})$/, type: 'local' },           // Local: 0XXXXXXXXX
    { regex: /^233([2-5][0-9])([0-9]{7})$/, type: 'international' }, // Without +: 233XXXXXXXXX
    { regex: /^\+233([2-5][0-9])([0-9]{7})$/, type: 'plus' }         // With +: +233XXXXXXXXX
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern.regex)
    if (match) {
      const prefix = match[1]
      const number = match[2]
      
      // Check if prefix is valid for Ghana networks
      if (validPrefixes.includes(prefix)) {
        // Return 10-digit local format as normalized (for VTU providers)
        const normalized = `0${prefix}${number}`
        const international = `233${prefix}${number}`
        return { valid: true, normalized, international }
      }
    }
  }

  // If no pattern matched, provide helpful error
  if (cleaned.length < 10) {
    return { valid: false, normalized: cleaned, international: cleaned, error: 'Phone number is too short' }
  }
  if (cleaned.length > 13) {
    return { valid: false, normalized: cleaned, international: cleaned, error: 'Phone number is too long' }
  }

  return { 
    valid: false, 
    normalized: cleaned,
    international: cleaned, 
    error: 'Invalid Ghana phone number. Use format: 0XXXXXXXXX or 233XXXXXXXXX' 
  }
}

/**
 * Normalize phone number to local format (0XXXXXXXXX)
 * This is the format VTU providers expect (10 digits)
 */
export function toLocalFormat(phone: string): string {
  const result = validateGhanaPhone(phone)
  if (!result.valid) return phone
  return result.normalized // Already in 0XXXXXXXXX format
}

/**
 * Normalize phone number to international format (233XXXXXXXXX)
 * Use this for SMS/notifications
 */
export function toInternationalFormat(phone: string): string {
  const result = validateGhanaPhone(phone)
  if (!result.valid) return phone
  return result.international
}

/**
 * Normalize phone number with + prefix (+233XXXXXXXXX)
 */
export function toPlusFormat(phone: string): string {
  const result = validateGhanaPhone(phone)
  if (!result.valid) return phone
  return '+' + result.international
}

/**
 * Check if two phone numbers are the same (after normalization)
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const result1 = validateGhanaPhone(phone1)
  const result2 = validateGhanaPhone(phone2)
  
  if (!result1.valid || !result2.valid) return false
  return result1.normalized === result2.normalized
}
