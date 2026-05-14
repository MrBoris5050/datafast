import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  logWebhookReceived,
  logStatusChange,
  logOrderEvent,
} from '@/lib/order-logs'
import { sendOrderWebhooks } from '@/lib/webhooks'
import { notifyOrderCompleted, notifyOrderFailed } from '@/lib/notifications'

// Hubnet webhook payload (completion callback):
// {
//   status: true | false,
//   reason: "Successful" | "Failed" | ...,
//   message: "0000" | "1001" | ...,   // "0000" = success
//   transaction_id: "TXN-...",
//   payment_id: "PSH-...",
//   reference: "<our reference>",
//   data: { status: true, code: "0000", message: "Order successfully placed." }
// }

function resolveNewStatus(body: any): 'COMPLETED' | 'FAILED' | 'PROCESSING' {
  // Primary signal: status field + message code
  const statusOk  = body?.status === true
  const msgCode   = String(body?.message ?? body?.data?.code ?? '').trim()
  const reason    = String(body?.reason  ?? '').toUpperCase().trim()
  const dataStatus = body?.data?.status

  if (statusOk && (msgCode === '0000' || dataStatus === true)) return 'COMPLETED'

  // Partial / in-progress signals
  if (msgCode === '0000' && !statusOk) return 'PROCESSING'

  // Explicit failure reasons from Hubnet status codes
  // 1001 = invalid network, 1002 = invalid volume, etc.
  if (!statusOk || reason.includes('FAIL') || reason.includes('ERROR') || reason.includes('INVALID')) {
    return 'FAILED'
  }

  return 'PROCESSING'
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Hubnet does not document an HMAC signature header, so we skip verification.
    // If they add one in future, check process.env.HUBNETGH_WEBHOOK_SECRET here.

    const hubnetRef    = String(body?.reference        ?? '').trim() // our reference (trimmed to 25)
    const transactionId = String(body?.transaction_id  ?? '').trim()
    const paymentId     = String(body?.payment_id       ?? '').trim()
    const reason        = String(body?.reason           ?? '').trim()
    const msgCode       = String(body?.message ?? body?.data?.code ?? '').trim()

    if (!hubnetRef && !transactionId) {
      return NextResponse.json({ error: 'Missing reference and transaction_id' }, { status: 400 })
    }

    // ── Find order ────────────────────────────────────────────────────────────
    // 1. By reference (most reliable — we pass our own reference in the payload)
    // 2. By providerReference (transaction_id stored at dispatch time)
    let order = null

    if (hubnetRef) {
      // Our reference may have been trimmed to 25 chars — try full-prefix match
      order = await prisma.order.findFirst({
        where: { reference: { startsWith: hubnetRef } },
        include: { plan: true, user: true },
        orderBy: { createdAt: 'desc' },
      })
      // Exact match as fallback (handles refs ≤25 chars stored as-is)
      if (!order) {
        order = await prisma.order.findUnique({
          where: { reference: hubnetRef },
          include: { plan: true, user: true },
        })
      }
    }

    if (!order && transactionId) {
      order = await prisma.order.findFirst({
        where: { providerReference: transactionId },
        include: { plan: true, user: true },
      })
    }

    if (!order) {
      console.warn('[Hubnet webhook] Order not found:', { hubnetRef, transactionId })
      // Acknowledge so Hubnet doesn't retry indefinitely
      return NextResponse.json({ received: true, message: 'Order not found' })
    }

    const newStatus = resolveNewStatus(body)

    await logWebhookReceived(order.id, 'HubnetGH', `status:${body?.status} message:${msgCode}`, {
      hubnetRef,
      transactionId,
      paymentId,
      reason,
      msgCode,
      rawStatus: body?.status,
    })

    // ── Skip if nothing changed ───────────────────────────────────────────────
    const needsProviderRef = transactionId && !order.providerReference
    const statusChanged    = newStatus !== order.status

    if (!statusChanged && !needsProviderRef) {
      return NextResponse.json({ received: true, message: 'No change' })
    }

    // ── Apply update ──────────────────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      const updateData: any = { status: newStatus, updatedAt: new Date() }

      if (needsProviderRef) updateData.providerReference = transactionId
      if (order.isManual && (newStatus === 'COMPLETED' || newStatus === 'PROCESSING')) {
        updateData.isManual = false
      }

      await tx.order.update({ where: { id: order.id }, data: updateData })

      if (newStatus === 'COMPLETED') {
        await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: 'COMPLETED' } })
        await tx.transaction.updateMany({ where: { reference: order.reference }, data: { status: 'COMPLETED' } })
      } else if (newStatus === 'FAILED') {
        await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: 'FAILED' } })
        await tx.transaction.updateMany({ where: { reference: order.reference }, data: { status: 'FAILED' } })

        // Refund wallet — guard against double-refund
        const existing = await tx.transaction.findFirst({
          where: { reference: { startsWith: `${order.reference}_refund` }, type: 'REFUND' },
        })
        if (!existing) {
          await tx.user.update({
            where: { id: order.userId },
            data: { walletBalance: { increment: order.amount } },
          })
          await tx.transaction.create({
            data: {
              userId:      order.userId,
              type:        'REFUND',
              amount:      order.amount as unknown as any,
              description: `Refund for failed Hubnet order: ${order.plan.name}${reason ? ` — ${reason}` : ''}`,
              reference:   `${order.reference}_refund`,
              status:      'COMPLETED',
            },
          })
        }
      }
    })

    // ── Logging (outside tx) ──────────────────────────────────────────────────
    await logStatusChange(order.id, order.status, newStatus, {
      source: 'webhook',
      provider: 'HubnetGH',
      transactionId,
      reason,
      msgCode,
    })

    if (order.isManual && (newStatus === 'COMPLETED' || newStatus === 'PROCESSING')) {
      await logOrderEvent(
        order.id,
        `Manual flag cleared — Hubnet webhook confirms order ${newStatus.toLowerCase()}`,
        newStatus === 'COMPLETED' ? 'SUCCESS' : 'INFO',
        { source: 'webhook', transactionId, newStatus }
      )
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    if (newStatus === 'COMPLETED' && order.status !== 'COMPLETED') {
      notifyOrderCompleted(order.userId, {
        reference: order.reference,
        planName:  order.plan.name,
        phone:     order.phone,
        amount:    Number(order.amount),
      }).catch(e => console.error('[Hubnet webhook] Notification error:', e))
    } else if (newStatus === 'FAILED' && order.status !== 'FAILED') {
      notifyOrderFailed(order.userId, {
        reference: order.reference,
        planName:  order.plan.name,
        phone:     order.phone,
        amount:    Number(order.amount),
        reason,
      }).catch(e => console.error('[Hubnet webhook] Notification error:', e))
    }

    // ── Outgoing developer webhooks ───────────────────────────────────────────
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { plan: true },
    })
    if (updatedOrder) {
      await sendOrderWebhooks(
        {
          ...updatedOrder,
          providerReference: updatedOrder.providerReference ?? null,
          plan: {
            id:         updatedOrder.plan.id,
            name:       updatedOrder.plan.name,
            dataAmount: updatedOrder.plan.dataAmount,
            network:    updatedOrder.plan.network,
            validity:   updatedOrder.plan.validity ? String(updatedOrder.plan.validity) : null,
          },
        },
        newStatus,
        order.status
      )
    }

    return NextResponse.json({
      success:        true,
      message:        'Webhook processed',
      orderReference: order.reference,
      status:         newStatus,
    })
  } catch (error: any) {
    console.error('[Hubnet webhook] Processing error:', error)
    // Return 200 so Hubnet doesn't retry on our internal errors
    return NextResponse.json({ error: error?.message ?? 'Webhook processing failed' }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Hubnet webhook endpoint is active' })
}
