import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/api-auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const auth = await authenticateApiKey(request.headers.get('authorization'))
    if (!auth.ok || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 })
    }
    const userId = auth.userId as string

    // Check rate limit (150 requests per minute per user)
    const rateLimit = checkRateLimit(userId, 150, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Maximum 150 requests per minute.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimit)
        }
      )
    }

    const { reference } = await context.params
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference parameter' }, { status: 400 })
    }

    // Find order by reference, ensuring it belongs to the authenticated user
    const order = await prisma.order.findFirst({
      where: {
        reference,
        userId, // Ensure the order belongs to the API key owner
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            dataAmount: true,
            validity: true,
            network: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        reference: order.reference,
        status: order.status,
        phone: order.phone,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        plan: order.plan
        ? {
            dataAmountGB: (order.plan.dataAmount / 1024) + 'GB',
            network: order.plan.network,
          }
          : null,
      },
    }, {
      headers: getRateLimitHeaders(rateLimit)
    })
  } catch (error: any) {
    console.error('Error fetching order status:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch order status' },
      { status: 500 }
    )
  }
}

