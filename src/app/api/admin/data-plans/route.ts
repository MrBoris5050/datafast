import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dataPlans = await prisma.dataPlan.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
    return NextResponse.json({ data: dataPlans })
  } catch (error) {
    console.error('Error fetching data plans:', error)
    return NextResponse.json({ error: 'Failed to fetch data plans' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, description, price, dataAmount, validity, network, priceCustomer, priceAgent, priceWholesaler, priceDealer, providerPlanId } = body

    // Validate required fields
    if (!name || !dataAmount || !validity || !network) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate at least one role price is provided
    const customerPrice = Number(priceCustomer ?? 0)
    const agentPrice = Number(priceAgent ?? 0)
    const wholesalerPrice = Number(priceWholesaler ?? 0)
    const dealerPrice = Number(priceDealer ?? 0)
    
    if (customerPrice <= 0 && agentPrice <= 0 && wholesalerPrice <= 0 && dealerPrice <= 0) {
      return NextResponse.json({ error: 'At least one role price must be provided' }, { status: 400 })
    }

    const dataPlan = await prisma.dataPlan.create({
      data: {
        name,
        description: description || '',
        price: price ? Number(price) : 0, // Keep for backward compatibility, but not required
        priceCustomer: customerPrice,
        priceAgent: agentPrice,
        priceWholesaler: wholesalerPrice,
        priceDealer: dealerPrice,
        dataAmount: Number(dataAmount),
        validity: Number(validity),
        network: network,
        providerPlanId: providerPlanId ? String(providerPlanId).trim() : undefined,
        isActive: true
      }
    })

    return NextResponse.json({ data: dataPlan })
  } catch (error) {
    console.error('Error creating data plan:', error)
    return NextResponse.json({ error: 'Failed to create data plan' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Use a transaction to delete orders first, then data plans
    const result = await prisma.$transaction(async (tx) => {
      // First, delete all orders that reference data plans
      const deletedOrders = await tx.order.deleteMany({})
      
      // Then delete all data plans
      const deletedPlans = await tx.dataPlan.deleteMany({})
      
      return {
        deletedOrdersCount: deletedOrders.count,
        deletedPlansCount: deletedPlans.count
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedPlansCount,
      deletedOrdersCount: result.deletedOrdersCount
    })
  } catch (error) {
    console.error('Error deleting all data plans:', error)
    return NextResponse.json({ error: 'Failed to delete all data plans' }, { status: 500 })
  }
}