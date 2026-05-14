import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cleanupExpiredResets } from '@/lib/cleanup-expired-resets'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cleanedCount = await cleanupExpiredResets()
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired/used password reset codes`
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup expired reset codes' },
      { status: 500 }
    )
  }
}




