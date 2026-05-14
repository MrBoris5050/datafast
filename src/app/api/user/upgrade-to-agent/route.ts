import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

const SETTING_KEY = 'agent_upgrade_price'

export async function GET() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY }
  })

  if (!setting) {
    return NextResponse.json({ enabled: false, price: null })
  }

  return NextResponse.json({ enabled: true, price: parseFloat(setting.value) })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, walletBalance: true }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Your account is already at Agent level or higher' },
      { status: 400 }
    )
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY }
  })

  if (!setting) {
    return NextResponse.json(
      { error: 'Agent upgrade is not currently available' },
      { status: 400 }
    )
  }

  const upgradePrice = parseFloat(setting.value)
  const walletBalance = parseFloat(user.walletBalance.toString())

  if (walletBalance < upgradePrice) {
    return NextResponse.json(
      {
        error: 'Insufficient wallet balance',
        required: upgradePrice,
        balance: walletBalance
      },
      { status: 400 }
    )
  }

  const reference = `UPGRADE-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'AGENT',
        walletBalance: { decrement: upgradePrice }
      }
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEBIT',
        amount: upgradePrice,
        description: 'Agent role upgrade fee',
        reference,
        status: 'COMPLETED'
      }
    })
  ])

  return NextResponse.json({
    success: true,
    message: 'Congratulations! Your account has been upgraded to Agent.',
    newRole: 'AGENT'
  })
}
