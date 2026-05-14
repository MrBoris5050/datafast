import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const PHONE_KEY = 'support_phone'
const WHATSAPP_KEY = 'whatsapp_channel_url'

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: [PHONE_KEY, WHATSAPP_KEY] } },
    })

    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

    return NextResponse.json(
      {
        supportPhone: map[PHONE_KEY] ?? '',
        whatsappChannelUrl: map[WHATSAPP_KEY] ?? '',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching contact settings:', error)
    return NextResponse.json(
      { supportPhone: '', whatsappChannelUrl: '' },
      { status: 500 }
    )
  }
}
