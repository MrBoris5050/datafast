// @ts-nocheck
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

// Load .env from project root
config({ path: resolve(__dirname, '../.env') })

const databaseUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL

if (!databaseUrl) {
  console.error(
    '❌ No database URL found. Set POSTGRES_PRISMA_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL in .env',
  )
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
})

function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(plain, salt, 64)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

async function createAdmin(email: string, password: string, name?: string) {
  try {
    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
      // Upgrade to ADMIN if already exists
      const updated = await prisma.user.update({
        where: { email },
        data: {
          role: UserRole.ADMIN,
          password: hashPassword(password),
          ...(name && { name }),
        },
      })
      console.log(`✅ Existing user upgraded to ADMIN`)
      console.log(`   ID:    ${updated.id}`)
      console.log(`   Email: ${updated.email}`)
      console.log(`   Role:  ${updated.role}`)
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          password: hashPassword(password),
          name: name ?? 'Admin',
          role: UserRole.ADMIN,
          isActive: true,
        },
      })
      console.log(`✅ Admin user created successfully`)
      console.log(`   ID:    ${created.id}`)
      console.log(`   Email: ${created.email}`)
      console.log(`   Role:  ${created.role}`)
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const email = process.argv[2] || 'mydatahubgh@gmail.com'
const password = process.argv[3] || 'Boris2122556'
const name = process.argv[4]

createAdmin(email, password, name)
