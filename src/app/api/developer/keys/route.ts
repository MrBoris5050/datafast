import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateApiKey } from '@/lib/api-auth'
import { encrypt, decrypt } from '@/lib/encryption'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Only fetch active (non-revoked) keys
  const keys = await prisma.aPIKey.findMany({
    where: { 
      userId: session.user.id,
      revoked: false // Only show active keys
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastFour: true, revoked: true, lastUsedAt: true, createdAt: true, encryptedKey: true },
  })
  
  // Decrypt the keys for display
  const keysWithFullKey = keys.map(key => ({
    ...key,
    fullKey: key.encryptedKey ? decrypt(key.encryptedKey) : null,
    encryptedKey: undefined, // Don't expose the encrypted value
  }))
  
  return NextResponse.json({ success: true, data: keysWithFullKey })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Check if user already has a non-revoked API key
  const existingKey = await prisma.aPIKey.findFirst({
    where: {
      userId: session.user.id,
      revoked: false
    }
  })

  if (existingKey) {
    return NextResponse.json(
      { error: 'You can only have one active API key. Please revoke your existing key before creating a new one.' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const name = (body?.name as string) || 'Default Key'
  const { raw, prefix, lastFour, hash } = generateApiKey()
  
  // Encrypt the raw key for later retrieval
  const encryptedKey = encrypt(raw)

  const key = await prisma.aPIKey.create({
    data: {
      userId: session.user.id,
      name,
      keyHash: hash,
      encryptedKey,
      prefix,
      lastFour,
    },
    select: { id: true, name: true, prefix: true, lastFour: true, createdAt: true },
  })

  // Return raw key on creation
  return NextResponse.json({ success: true, data: { ...key, raw } })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { id, action, name } = body as { id: string; action: 'revoke' | 'rename'; name?: string }
  if (!id || !action) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const key = await prisma.aPIKey.findFirst({ where: { id, userId: session.user.id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'revoke') {
    // Delete the key instead of marking as revoked
    await prisma.aPIKey.delete({ where: { id } })
  } else if (action === 'rename') {
    await prisma.aPIKey.update({ where: { id }, data: { name: name || key.name } })
  }

  return NextResponse.json({ success: true })
}


