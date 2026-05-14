import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillOrderNumbers() {
  try {
    console.log('Starting order number backfill...')

    // Get all orders without order numbers, ordered by creation date (oldest first)
    const ordersWithoutNumbers = await prisma.order.findMany({
      where: {
        orderNumber: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    console.log(`Found ${ordersWithoutNumbers.length} orders without order numbers`)

    if (ordersWithoutNumbers.length === 0) {
      console.log('No orders to backfill')
      return
    }

    // Get the maximum existing order number
    const maxOrder = await prisma.order.findFirst({
      where: {
        orderNumber: { not: null },
      },
      orderBy: {
        orderNumber: 'desc',
      },
      select: {
        orderNumber: true,
      },
    })

    // Start from the next number after the max, or 1 if no orders have numbers
    let nextNumber = maxOrder?.orderNumber ? maxOrder.orderNumber + 1 : 1

    console.log(`Starting order numbers from: ${nextNumber}`)

    // Update each order with a sequential number
    for (const order of ordersWithoutNumbers) {
      await prisma.order.update({
        where: { id: order.id },
        data: { orderNumber: nextNumber },
      })
      console.log(`Assigned order number ${nextNumber} to order ${order.id} (created: ${order.createdAt})`)
      nextNumber++
    }

    console.log(`Successfully backfilled ${ordersWithoutNumbers.length} orders`)
    console.log(`Order numbers assigned: ${maxOrder?.orderNumber ? maxOrder.orderNumber + 1 : 1} to ${nextNumber - 1}`)
  } catch (error) {
    console.error('Error backfilling order numbers:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillOrderNumbers()
  .then(() => {
    console.log('Backfill completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })






