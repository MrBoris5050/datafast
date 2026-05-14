import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, description, price, dataAmount, validity, network, isActive, priceCustomer, priceAgent, priceWholesaler, priceDealer, providerPlanId } = body

    const data: any = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description.trim()
    if (providerPlanId !== undefined) data.providerPlanId = providerPlanId ? String(providerPlanId).trim() : null
    if (price !== undefined) data.price = Number(price)
    if (priceCustomer !== undefined) data.priceCustomer = Number(priceCustomer)
    if (priceAgent !== undefined) data.priceAgent = Number(priceAgent)
    if (priceWholesaler !== undefined) data.priceWholesaler = Number(priceWholesaler)
    if (priceDealer !== undefined) data.priceDealer = Number(priceDealer)
    if (dataAmount !== undefined) data.dataAmount = Number(dataAmount)
    if (validity !== undefined) data.validity = Number(validity)
    if (isActive !== undefined) data.isActive = Boolean(isActive)
    if (network !== undefined) {
      data.network = network
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const updated = await prisma.dataPlan.update({
      where: { id },
      data
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating data plan:', error)
    return NextResponse.json({ error: 'Failed to update data plan' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await prisma.dataPlan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting data plan:', error)
    return NextResponse.json({ error: 'Failed to delete data plan' }, { status: 500 })
  }
}
