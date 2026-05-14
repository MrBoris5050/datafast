import { NextRequest, NextResponse } from 'next/server'
import { checkStuckOrders } from '@/lib/stuck-orders'

/**
 * Automated cron endpoint for resolving orders stuck in PROCESSING.
 * Called by Vercel Cron on a schedule (see vercel.json).
 * Also callable manually by admins.
 *
 * Security: protected by CRON_SECRET env var. Vercel sets Authorization header
 * automatically for cron invocations.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = Date.now()

  try {
    console.log('[Cron:StuckOrders] Starting stuck-orders check')

    const results = await checkStuckOrders({
      stuckThreshold: 20 * 60 * 1000, // 20 minutes — faster than the default 1 hour
      batchSize: 50,
      // Only mark manual when the provider explicitly confirms failure.
      // Endpoint errors / HTML responses leave the order in PROCESSING for the webhook.
      autoMarkManual: false,
    })

    const summary = {
      total: results.length,
      completed: results.filter(r => r.action === 'completed').length,
      failed: results.filter(r => r.action === 'failed').length,
      manual: results.filter(r => r.action === 'manual').length,
      unchanged: results.filter(r => r.action === 'unchanged').length,
      errors: results.filter(r => r.action === 'error').length,
      durationMs: Date.now() - startedAt,
    }

    console.log('[Cron:StuckOrders] Completed', summary)

    return NextResponse.json({ success: true, summary, results })
  } catch (error: any) {
    console.error('[Cron:StuckOrders] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Unknown error', durationMs: Date.now() - startedAt },
      { status: 500 }
    )
  }
}
