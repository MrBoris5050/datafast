import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cleanupExpiredTopups } from '@/lib/cleanup-expired-topups'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cleanedCount = await cleanupExpiredTopups()
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired pending top-up transactions`,
      count: cleanedCount
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup expired top-ups' },
      { status: 500 }
    )
  }
}




