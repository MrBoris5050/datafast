import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateReference } from '@/lib/paystack'
import { getPlanPriceForRole } from '@/lib/pricing'
import { validateGhanaPhone } from '@/lib/phone-validation'
import { dispatchToProvider } from '@/lib/provider-dispatch'
import { logOrderCreated, logOrderEvent, logPaymentProcessing } from '@/lib/order-logs'

/** Deduplication window — same user + plan + phone within 5 min returns the existing order. */
const DEDUP_WINDOW_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => null)
  const { planId, phoneNumber } = body ?? {}
  if (!planId || !phoneNumber) {
    return NextResponse.json({ error: 'planId and phoneNumber are required' }, { status: 400 })
  }

  const phoneResult = validateGhanaPhone(phoneNumber)
  if (!phoneResult.valid) {
    return NextResponse.json({ error: phoneResult.error ?? 'Invalid phone number' }, { status: 400 })
  }
  const phone = phoneResult.normalized!

  // ── Load user + plan ────────────────────────────────────────────────────────
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.dataPlan.findUnique({ where: { id: planId } }),
  ])

  if (!user || !plan) {
    return NextResponse.json({ error: 'User or plan not found' }, { status: 404 })
  }
  if (!plan.isActive) {
    return NextResponse.json({ error: 'This plan is no longer available' }, { status: 400 })
  }

  const price = getPlanPriceForRole(plan as any, user.role)
  if (Number(user.walletBalance) < price) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
  }

  // ── Deduplication ───────────────────────────────────────────────────────────
  const existing = await prisma.order.findFirst({
    where: {
      userId:    user.id,
      planId:    plan.id,
      phone,
      createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    },
    select: { reference: true, status: true },
  })

  if (existing) {
    return NextResponse.json({
      success:   true,
      reference: existing.reference,
      status:    existing.status,
      duplicate: true,
      message:   'Order already in progress. Please wait for it to complete.',
    })
  }

  // ── Atomic transaction: debit wallet + create order + create transaction ────
  const reference = generateReference()
  let orderId!: string

  await prisma.$transaction(async (tx) => {
    // Sequential order number
    const last = await tx.order.findFirst({
      where:   { orderNumber: { not: null } },
      orderBy: { orderNumber: 'desc' },
      select:  { orderNumber: true },
    })
    const orderNumber = (last?.orderNumber ?? 0) + 1

    await tx.user.update({
      where: { id: user.id },
      data:  { walletBalance: { decrement: price } },
    })

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId:    user.id,
        planId:    plan.id,
        phone,
        reference,
        amount:    price as any,
        status:    'PROCESSING',
      },
    })
    orderId = order.id

    await tx.transaction.create({
      data: {
        userId:      user.id,
        type:        'PURCHASE',
        amount:      price as any,
        description: `Purchase: ${plan.name}`,
        reference,
        status:      'PENDING',
      },
    })

    // Logs written inside the transaction so they roll back if anything fails
    await logOrderCreated(orderId, reference, {
      orderNumber,
      network:  plan.network,
      planName: plan.name,
      amount:   price,
      phone,
    }, tx)
    await logPaymentProcessing(orderId, 'wallet', price, { reference }, tx)
  })

  // ── Load network provider config (outside transaction — non-critical read) ──
  const network = await prisma.network.findUnique({ where: { name: plan.network } })

  // Log which provider will handle this order
  const apiProv = network?.apiProvider?.toUpperCase() ?? ''
  const credsEnv =
    apiProv === 'DATADASHGH'
      ? !!process.env.DATADASHGH_API_KEY
      : apiProv === 'DATAWAVEGH'
        ? !!process.env.DATAWAVEGH_API_KEY
        : !!process.env.DATAHUBGH_API_KEY

  await logOrderEvent(orderId, `Dispatching to provider: ${network?.apiProvider ?? 'MANUAL'}`, 'INFO', {
    network:            plan.network,
    provider:           network?.apiProvider ?? null,
    providerNetworkKey: network?.providerNetworkKey ?? null,
    credentialsSource:  credsEnv ? 'env' : 'db',
  })

  // ── Dispatch to provider AFTER response is sent ─────────────────────────────
  // next/server `after()` runs the callback once the HTTP response has been flushed.
  // The UI gets its answer immediately; fulfillment happens in the background.
  after(async () => {
    await dispatchToProvider({
      orderId,
      reference,
      network: {
        apiProvider:        network?.apiProvider        ?? null,
        apiKey:             network?.apiKey             ?? null,
        baseUrl:            network?.baseUrl            ?? null,
        providerNetworkKey: network?.providerNetworkKey ?? null,
      },
      phone,
      dataAmountMB: plan.dataAmount,
      planName:     plan.name,
      planNetwork:  plan.network,
      providerPlanId: plan.providerPlanId,
    })
  })

  // ── Respond immediately ─────────────────────────────────────────────────────
  return NextResponse.json({
    success:   true,
    reference,
    status:    'PROCESSING',
    message:   'Order placed. You will be notified when it completes.',
  })
}
