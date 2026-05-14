import { prisma } from './db'

/**
 * Clean up expired password reset codes from the database
 * This should be run periodically (e.g., via a cron job)
 */
export async function cleanupExpiredResets() {
  try {
    const result = await prisma.passwordReset.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Expired codes
          { used: true } // Already used codes
        ]
      }
    })

    console.log(`Cleaned up ${result.count} expired/used password reset codes`)
    return result.count
  } catch (error) {
    console.error('Error cleaning up expired reset codes:', error)
    throw error
  }
}

/**
 * Clean up expired reset codes for a specific user
 */
export async function cleanupUserResets(userId: string) {
  try {
    const result = await prisma.passwordReset.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lt: new Date() } },
          { used: true }
        ]
      }
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up user reset codes:', error)
    throw error
  }
}




