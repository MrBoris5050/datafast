import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get pagination params from URL
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const skip = (page - 1) * limit

    // Count total users with at least one active (non-revoked) API key
    const totalUsers = await prisma.user.count({
      where: {
        apiKeys: {
          some: { revoked: false } // Only users with at least one active API key
        }
      }
    })

    // Fetch only users who have at least one active API key with pagination
    const users = await prisma.user.findMany({
      where: {
        apiKeys: {
          some: { revoked: false } // Only users with at least one active API key
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        avatar: true,
        walletBalance: true,
        apiKeys: {
          where: { revoked: false }, // Only fetch active keys
          select: {
            id: true,
            name: true,
            prefix: true,
            lastFour: true,
            revoked: true,
            lastUsedAt: true,
            createdAt: true,
            encryptedKey: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // For each user, count API calls (orders made via API)
    const usersWithApiCalls = await Promise.all(
      users.map(async (user) => {
        // Count orders made via API (isManual = false)
        const apiOrderCount = await prisma.order.count({
          where: {
            userId: user.id,
            isManual: false,
          },
        })

        // Count total API keys (active and revoked)
        const totalKeys = user.apiKeys.length
        const activeKeys = user.apiKeys.filter((k) => !k.revoked).length

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive,
          createdAt: user.createdAt,
          avatar: user.avatar,
          walletBalance: Number(user.walletBalance),
          apiKeys: user.apiKeys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            lastFour: key.lastFour,
            revoked: key.revoked,
            lastUsedAt: key.lastUsedAt,
            createdAt: key.createdAt,
            displayKey: `${key.prefix}...${key.lastFour}`,
            fullKey: key.encryptedKey ? decrypt(key.encryptedKey) : null,
          })),
          totalApiCalls: apiOrderCount,
          totalKeys,
          activeKeys,
        }
      })
    )

    // Calculate total active API keys (for stats)
    const totalApiKeys = await prisma.aPIKey.count({ where: { revoked: false } })

    return NextResponse.json({ 
      success: true, 
      data: usersWithApiCalls,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        hasMore: page * limit < totalUsers
      },
      stats: {
        totalUsersWithKeys: totalUsers,
        totalApiKeys,
        totalActiveApiKeys: totalApiKeys // All keys shown are active now
      }
    })
  } catch (error: any) {
    console.error('Error fetching users with API keys:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch users and API keys' },
      { status: 500 }
    )
  }
}






