import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Optimized: Only select needed fields
    const items = await prisma.network.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    })
    
    // Cache headers without background revalidation
    return NextResponse.json(
      { success: true, data: items },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching networks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch networks' },
      { status: 500 }
    )
  }
}


