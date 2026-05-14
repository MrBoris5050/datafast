import { prisma } from '@/lib/db'

/**
 * Get the default price for a voucher type
 */
export async function getVoucherPrice(type: 'BECE' | 'WASSCE'): Promise<number> {
  try {
    const pricing = await prisma.voucherPricing.findUnique({
      where: { type }
    })

    if (pricing) {
      return Number(pricing.price)
    }

    // Default prices if not set
    const defaultPrice = type === 'BECE' ? 5.00 : 10.00
    
    // Create default pricing
    await prisma.voucherPricing.upsert({
      where: { type },
      update: {},
      create: {
        type,
        price: defaultPrice
      }
    })

    return defaultPrice
  } catch (error) {
    console.error('Error getting voucher price:', error)
    // Return default price on error
    return type === 'BECE' ? 5.00 : 10.00
  }
}

/**
 * Get all voucher pricing
 */
export async function getAllVoucherPricing() {
  try {
    const pricing = await prisma.voucherPricing.findMany({
      orderBy: { type: 'asc' }
    })

    // Ensure both types exist
    const becePricing = pricing.find(p => p.type === 'BECE')
    const wasscePricing = pricing.find(p => p.type === 'WASSCE')

    if (!becePricing) {
      await prisma.voucherPricing.upsert({
        where: { type: 'BECE' },
        update: {},
        create: { type: 'BECE', price: 5.00 }
      })
    }

    if (!wasscePricing) {
      await prisma.voucherPricing.upsert({
        where: { type: 'WASSCE' },
        update: {},
        create: { type: 'WASSCE', price: 10.00 }
      })
    }

    return await prisma.voucherPricing.findMany({
      orderBy: { type: 'asc' }
    })
  } catch (error) {
    console.error('Error getting all voucher pricing:', error)
    return []
  }
}

