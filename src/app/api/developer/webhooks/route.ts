import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hooks = await prisma.webhookSubscription.findMany({
    where: { userId: session.user.id },
    select: { id: true, url: true, active: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: hooks })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Check if user already has a webhook subscription
  const existingHook = await prisma.webhookSubscription.findFirst({
    where: {
      userId: session.user.id
    }
  })

  if (existingHook) {
    return NextResponse.json(
      { error: 'You can only have one webhook URL. Please update or delete your existing webhook first.' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const url = body?.url as string
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  const secret = crypto.randomBytes(24).toString('hex')
  const hook = await prisma.webhookSubscription.create({ data: { userId: session.user.id, url, secret } })
  return NextResponse.json({ success: true, data: { id: hook.id, url: hook.url, active: hook.active, secret } })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { id, action, url } = body as { id: string; action: 'toggle' | 'update_url'; url?: string }
  if (!id || !action) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const hook = await prisma.webhookSubscription.findFirst({ where: { id, userId: session.user.id } })
  if (!hook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (action === 'toggle') {
    await prisma.webhookSubscription.update({ where: { id }, data: { active: !hook.active } })
  } else if (action === 'update_url' && url) {
    await prisma.webhookSubscription.update({ where: { id }, data: { url } })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const hook = await prisma.webhookSubscription.findFirst({ where: { id, userId: session.user.id } })
  if (!hook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.webhookSubscription.delete({ where: { id } })
  return NextResponse.json({ success: true })
}


