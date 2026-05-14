import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const PHONE_KEY = 'support_phone'
const WHATSAPP_KEY = 'whatsapp_channel_url'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: [PHONE_KEY, WHATSAPP_KEY] } },
  })

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  return NextResponse.json({
    supportPhone: map[PHONE_KEY] ?? '',
    whatsappChannelUrl: map[WHATSAPP_KEY] ?? '',
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const supportPhoneRaw = typeof body.supportPhone === 'string' ? body.supportPhone.trim() : ''
  const whatsappRaw = typeof body.whatsappChannelUrl === 'string' ? body.whatsappChannelUrl.trim() : ''

  if (whatsappRaw) {
    try {
      const u = new URL(whatsappRaw)
      if (!/^https?:$/.test(u.protocol)) throw new Error('invalid protocol')
    } catch {
      return NextResponse.json(
        { error: 'WhatsApp channel URL must be a valid http(s) URL' },
        { status: 400 }
      )
    }
  }

  await prisma.$transaction([
    supportPhoneRaw
      ? prisma.systemSetting.upsert({
          where: { key: PHONE_KEY },
          update: { value: supportPhoneRaw },
          create: { key: PHONE_KEY, value: supportPhoneRaw },
        })
      : prisma.systemSetting.deleteMany({ where: { key: PHONE_KEY } }),
    whatsappRaw
      ? prisma.systemSetting.upsert({
          where: { key: WHATSAPP_KEY },
          update: { value: whatsappRaw },
          create: { key: WHATSAPP_KEY, value: whatsappRaw },
        })
      : prisma.systemSetting.deleteMany({ where: { key: WHATSAPP_KEY } }),
  ])

  return NextResponse.json({
    success: true,
    supportPhone: supportPhoneRaw,
    whatsappChannelUrl: whatsappRaw,
  })
}
