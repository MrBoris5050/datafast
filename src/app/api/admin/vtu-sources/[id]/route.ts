import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, provider, baseUrl, apiKey, isDefault, active } = body
  const data: any = {}
  if (name !== undefined) data.name = String(name)
  if (provider !== undefined) data.provider = String(provider)
  if (baseUrl !== undefined) data.baseUrl = String(baseUrl)
  if (apiKey !== undefined) data.apiKey = String(apiKey)
  if (active !== undefined) data.active = !!active
  if (isDefault === true) {
    await prisma.vtuSource.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
    data.isDefault = true
  } else if (isDefault === false) {
    data.isDefault = false
  }
  const updated = await prisma.vtuSource.update({ where: { id }, data })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.vtuSource.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

