import { prisma } from './db'

/**
 * Clean up expired pending top-up transactions (older than 1 hour)
 * This should be run periodically (e.g., via a cron job or API endpoint)
 */
export async function cleanupExpiredTopups() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const result = await prisma.transaction.updateMany({
      where: {
        type: 'TOPUP',
        status: 'PENDING',
        createdAt: {
          lt: oneHourAgo
        }
      },
      data: {
        status: 'FAILED',
        description: 'Transaction expired - payment not completed within 1 hour'
      }
    })

    console.log(`Cleaned up ${result.count} expired pending top-up transactions`)
    return result.count
  } catch (error) {
    console.error('Error cleaning up expired top-ups:', error)
    throw error
  }
}




