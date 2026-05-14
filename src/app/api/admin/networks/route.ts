import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const items = await prisma.network.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ success: true, data: items })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const name = (body?.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  try {
    const created = await prisma.network.create({ data: { name } })
    return NextResponse.json({ success: true, data: created })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create network' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await prisma.network.deleteMany({})
    return NextResponse.json({ success: true, deletedCount: result.count })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete all networks' }, { status: 500 })
  }
}


