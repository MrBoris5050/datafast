import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { keyId } = await params
    const body = await req.json().catch(() => ({}))
    const { action } = body as { action: 'revoke' | 'delete' }

    if (!action || (action !== 'revoke' && action !== 'delete')) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "revoke" or "delete"' },
        { status: 400 }
      )
    }

    // Find the API key
    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: keyId },
      select: { id: true, revoked: true, userId: true, name: true, prefix: true, lastFour: true },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Delete the API key (both revoke and delete actions now delete the key)
    await prisma.aPIKey.delete({
      where: { id: keyId },
    })

    return NextResponse.json({
      success: true,
      message: `API key "${apiKey.name}" deleted successfully`,
    })
  } catch (error: any) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete API key' },
      { status: 500 }
    )
  }
}


