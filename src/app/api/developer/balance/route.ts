import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/api-auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
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

    // Fetch user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletBalance: true,
        email: true,
        name: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        balance: Number(user.walletBalance || 0),
        currency: 'GHS',
      },
    }, {
      headers: getRateLimitHeaders(rateLimit)
    })
  } catch (error: any) {
    console.error('Error fetching balance:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}


