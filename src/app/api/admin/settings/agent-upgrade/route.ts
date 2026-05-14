import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const SETTING_KEY = 'agent_upgrade_price'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY }
  })

  return NextResponse.json({
    price: setting ? parseFloat(setting.value) : null,
    enabled: setting !== null
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const { price, enabled } = body

  if (enabled === false) {
    await prisma.systemSetting.deleteMany({ where: { key: SETTING_KEY } })
    return NextResponse.json({ success: true, message: 'Agent upgrade disabled' })
  }

  const parsed = parseFloat(price)
  if (isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 })
  }

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: parsed.toFixed(2) },
    create: { key: SETTING_KEY, value: parsed.toFixed(2) }
  })

  return NextResponse.json({ success: true, price: parsed })
}
