import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  checkStuckOrders, 
  getStuckOrdersCount, 
  getStuckOrdersList 
} from '@/lib/stuck-orders'

/**
 * GET /api/admin/stuck-orders
 * Get list of stuck orders and optionally trigger status check
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'list', 'count', or 'check'
    const thresholdMs = parseInt(searchParams.get('threshold') || '3600000') // Default 1 hour
    const limit = parseInt(searchParams.get('limit') || '100')

    if (action === 'count') {
      const count = await getStuckOrdersCount(thresholdMs)
      return NextResponse.json({ 
        success: true,
        count,
        thresholdMinutes: thresholdMs / 60000
      })
    }

    if (action === 'check') {
      // Actually check and update stuck orders
      const results = await checkStuckOrders({
        stuckThreshold: thresholdMs,
        batchSize: limit,
        autoMarkManual: true
      })
      
      return NextResponse.json({
        success: true,
        processed: results.length,
        results,
        summary: {
          completed: results.filter(r => r.action === 'completed').length,
          failed: results.filter(r => r.action === 'failed').length,
          manual: results.filter(r => r.action === 'manual').length,
          unchanged: results.filter(r => r.action === 'unchanged').length,
          errors: results.filter(r => r.action === 'error').length
        }
      })
    }

    // Default: list stuck orders
    const orders = await getStuckOrdersList(thresholdMs, limit)
    const count = await getStuckOrdersCount(thresholdMs)
    
    return NextResponse.json({
      success: true,
      count,
      orders: orders.map(order => ({
        id: order.id,
        reference: order.reference,
        orderNumber: order.orderNumber,
        status: order.status,
        isManual: order.isManual,
        providerReference: order.providerReference,
        phone: order.phone,
        amount: Number(order.amount),
        plan: order.plan,
        user: order.user,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        stuckDuration: Date.now() - new Date(order.updatedAt).getTime()
      })),
      thresholdMinutes: thresholdMs / 60000
    })
  } catch (error: any) {
    console.error('Stuck orders API error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to check stuck orders' 
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/stuck-orders
 * Trigger stuck orders check with custom options
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      stuckThreshold = 3600000, // 1 hour default
      batchSize = 50,
      autoMarkManual = true
    } = body

    const results = await checkStuckOrders({
      stuckThreshold,
      batchSize,
      autoMarkManual
    })

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      summary: {
        completed: results.filter(r => r.action === 'completed').length,
        failed: results.filter(r => r.action === 'failed').length,
        manual: results.filter(r => r.action === 'manual').length,
        unchanged: results.filter(r => r.action === 'unchanged').length,
        errors: results.filter(r => r.action === 'error').length
      }
    })
  } catch (error: any) {
    console.error('Stuck orders check error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to check stuck orders' 
    }, { status: 500 })
  }
}
