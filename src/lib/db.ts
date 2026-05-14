import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma with connection pool settings
const prismaClientOptions = {
  log: (process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']) as Array<'error' | 'warn' | 'info' | 'query'>,
  errorFormat: 'pretty' as const,
}

// Create singleton instance - MUST be preserved in both dev AND production
export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions)

// Always preserve the instance to prevent connection pool exhaustion
// This is critical for serverless/edge environments
globalForPrisma.prisma = prisma
