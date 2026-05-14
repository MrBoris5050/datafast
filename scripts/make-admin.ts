import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function makeAdmin(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: UserRole.ADMIN },
    })

    console.log(`✅ Successfully made ${email} an ADMIN`)
    console.log(`User ID: ${user.id}`)
    console.log(`Name: ${user.name || 'N/A'}`)
    console.log(`Role: ${user.role}`)
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email ${email} not found`)
    } else {
      console.error('❌ Error:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const email = process.argv[2] || 'realice991@gmail.com'
makeAdmin(email)

