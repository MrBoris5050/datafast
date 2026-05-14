import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Convenience endpoint to add/update a DataHubGH VTU source with sane defaults
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name: string = body?.name || 'DataHubGH'
  const baseUrl: string = body?.baseUrl || 'https://user.datahubgh.com/api'
  const apiKey: string | undefined = body?.apiKey
  const isDefault: boolean = body?.isDefault ?? true
  const active: boolean = body?.active ?? true

  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
  }

  if (isDefault) {
    await prisma.vtuSource.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
  }

  // Upsert by name+provider so repeated calls update
  const existing = await prisma.vtuSource.findFirst({ where: { name, provider: 'DATAHUBGH' } })
  const record = existing
    ? await prisma.vtuSource.update({ where: { id: existing.id }, data: { baseUrl, apiKey, isDefault, active } })
    : await prisma.vtuSource.create({ data: { name, provider: 'DATAHUBGH', baseUrl, apiKey, isDefault, active } })

  return NextResponse.json({ data: record })
}


