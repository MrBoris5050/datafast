import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SALT_BYTES = 16
const KEYLEN = 64

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES)
  const derived = scryptSync(plain, salt, KEYLEN)
  // Store as salt:hash (hex)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = scryptSync(plain, salt, expected.length)
  // constant-time compare
  return timingSafeEqual(derived, expected)
}


