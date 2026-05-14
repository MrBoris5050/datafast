import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const items = await prisma.vtuSource.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { name, provider, baseUrl, apiKey, isDefault, active } = body
  if (!name || !provider || !baseUrl || !apiKey) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (isDefault) {
    await prisma.vtuSource.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
  }
  const created = await prisma.vtuSource.create({
    data: { name, provider, baseUrl, apiKey, isDefault: !!isDefault, active: active ?? true },
  })
  return NextResponse.json({ data: created })
}

