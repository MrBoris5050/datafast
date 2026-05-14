import crypto from 'crypto'
import { prisma } from '@/lib/db'

export interface APIAuthResult {
  ok: boolean
  error?: string
  userId?: string
  apiKeyId?: string
}

function hashKey(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function authenticateApiKey(authorizationHeader?: string | null): Promise<APIAuthResult> {
  if (!authorizationHeader) return { ok: false, error: 'Missing Authorization header' }
  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return { ok: false, error: 'Invalid Authorization header' }

  // Token format: prefix_live_xxx... Random string; we only store hash in DB
  const prefix = token.slice(0, 8)
  const lastFour = token.slice(-4)
  const tokenHash = hashKey(token)

  try {
    const key = await prisma.aPIKey.findFirst({
      where: {
        prefix,
        lastFour,
        keyHash: tokenHash,
        revoked: false,
      },
      select: { id: true, userId: true },
    })

    if (!key) return { ok: false, error: 'Invalid API key' }

    // update lastUsedAt (best-effort)
    prisma.aPIKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

    return { ok: true, userId: key.userId, apiKeyId: key.id }
  } catch (error: any) {
    // Handle database connection errors
    if (error?.code === 'P1001' || error?.message?.includes("Can't reach database server")) {
      console.error('Database connection error:', error.message)
      return { 
        ok: false, 
        error: 'Database connection failed. Please check your database server is running and accessible.' 
      }
    }
    // Re-throw other errors
    throw error
  }
}

export function generateApiKey(): { raw: string; prefix: string; lastFour: string; hash: string } {
  const raw = `dw_live_${crypto.randomBytes(24).toString('base64url')}`
  const prefix = raw.slice(0, 8)
  const lastFour = raw.slice(-4)
  const hash = hashKey(raw)
  return { raw, prefix, lastFour, hash }
}


