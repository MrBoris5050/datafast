import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  try {
    await prisma.network.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete network' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body.name === 'string')        data.name = body.name.trim()
  if (typeof body.isActive === 'boolean')   data.isActive = body.isActive
  // Provider config fields
  if ('apiProvider'        in body) data.apiProvider        = body.apiProvider        ?? null
  if ('apiKey'             in body) data.apiKey             = body.apiKey             ?? null
  if ('baseUrl'            in body) data.baseUrl            = body.baseUrl            ?? null
  if ('providerNetworkKey' in body) data.providerNetworkKey = body.providerNetworkKey ?? null
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No changes' }, { status: 400 })

  try {
    const updated = await prisma.network.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update network' }, { status: 500 })
  }
}


