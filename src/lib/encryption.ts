import crypto from 'crypto'

// Use a secret key from environment or generate a default one
// In production, this MUST be set via environment variable
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'datafast-api-key-encryption-secret-32chars'

// Ensure the key is exactly 32 bytes for AES-256
function getKey(): Buffer {
  const key = ENCRYPTION_KEY
  if (key.length >= 32) {
    return Buffer.from(key.slice(0, 32))
  }
  // Pad with zeros if too short
  return Buffer.from(key.padEnd(32, '0'))
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getKey()
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return iv:authTag:encrypted as a single string
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a string that was encrypted using the encrypt function
 */
export function decrypt(encryptedText: string): string | null {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      return null
    }
    
    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const key = getKey()
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch {
    // Return null if decryption fails
    return null
  }
}

