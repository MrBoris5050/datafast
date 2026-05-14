import { prisma } from './db'

/**
 * Get the next sequential order number
 * This function ensures thread-safe order number generation
 */
export async function getNextOrderNumber(): Promise<number> {
  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get the maximum order number (only non-null values)
    const maxOrder = await tx.order.findFirst({
      where: { orderNumber: { not: null } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    })

    // If no orders exist or no orders have orderNumber, start from 1, otherwise increment
    const nextNumber = maxOrder?.orderNumber ? maxOrder.orderNumber + 1 : 1

    return nextNumber
  })

  return result
}

