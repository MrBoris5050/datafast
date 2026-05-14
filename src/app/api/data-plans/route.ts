import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlanPriceForRole } from '@/lib/pricing'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const network = searchParams.get('network')

    const where = network && network !== 'All' 
      ? { network, isActive: true }
      : { isActive: true }

    const dataPlans = await prisma.dataPlan.findMany({
      where,
      orderBy: [
        { network: 'asc' },
        { price: 'asc' }
      ]
    })

    const session = await getServerSession(authOptions)
    const role = (session?.user?.role as any) || 'CUSTOMER'
    const withEffective = dataPlans.map((p: any) => ({
      ...p,
      effectivePrice: getPlanPriceForRole(p, role),
    }))
    withEffective.sort((a: any, b: any) => Number(a.effectivePrice) - Number(b.effectivePrice))

    return NextResponse.json({
      success: true,
      data: withEffective
    })
  } catch (error) {
    console.error('Error fetching data plans:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data plans' },
      { status: 500 }
    )
  }
}
