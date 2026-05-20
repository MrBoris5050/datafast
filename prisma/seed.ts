// @ts-nocheck
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create networks first
  console.log('Creating networks...')
  const networks = [
    { name: 'MTN' },
    { name: 'TELECEL' },
    { name: 'AirtelTigo BIGTIME' },
    { name: 'AirtelTigo ISHARE' },
  ]

  for (const network of networks) {
    await prisma.network.upsert({
      where: { name: network.name },
      update: { isActive: true },
      create: {
        name: network.name,
        isActive: true,
      },
    })
  }

  console.log('Networks created/verified successfully!')

  // Create MTN data plans
  const mtnDataPlans = [
    { name: 'MTN 1GB', dataAmount: 1024 },      // 1GB in MB
    { name: 'MTN 2GB', dataAmount: 2048 },      // 2GB in MB
    { name: 'MTN 3GB', dataAmount: 3072 },      // 3GB in MB
    { name: 'MTN 4GB', dataAmount: 4096 },      // 4GB in MB
    { name: 'MTN 5GB', dataAmount: 5120 },      // 5GB in MB
    { name: 'MTN 6GB', dataAmount: 6144 },      // 6GB in MB
    { name: 'MTN 7GB', dataAmount: 7168 },      // 7GB in MB
    { name: 'MTN 8GB', dataAmount: 8192 },      // 8GB in MB
    { name: 'MTN 9GB', dataAmount: 9216 },      // 9GB in MB
    { name: 'MTN 10GB', dataAmount: 10240 },    // 10GB in MB
    { name: 'MTN 15GB', dataAmount: 15360 },    // 15GB in MB
    { name: 'MTN 20GB', dataAmount: 20480 },    // 20GB in MB
    { name: 'MTN 25GB', dataAmount: 25600 },    // 25GB in MB
    { name: 'MTN 30GB', dataAmount: 30720 },    // 30GB in MB
    { name: 'MTN 40GB', dataAmount: 40960 },    // 40GB in MB
    { name: 'MTN 50GB', dataAmount: 51200 },    // 50GB in MB
    { name: 'MTN 100GB', dataAmount: 102400 },  // 100GB in MB
  ]

  console.log('Creating MTN data plans...')
  for (const plan of mtnDataPlans) {
    // Check if plan already exists
    const existingPlan = await prisma.dataPlan.findFirst({
      where: {
        name: plan.name,
        network: 'MTN',
      },
    })

    if (existingPlan) {
      // Update existing plan but preserve prices
      await prisma.dataPlan.update({
        where: { id: existingPlan.id },
        data: {
          description: `${plan.dataAmount / 1024}GB MTN data bundle`,
          dataAmount: plan.dataAmount,
          validity: 90,
          isActive: true,
          // Keep existing prices
        },
      })
    } else {
      // Create new plan with zero prices (admin will set role prices manually)
      await prisma.dataPlan.create({
        data: {
          name: plan.name,
          description: `${plan.dataAmount / 1024}GB MTN data bundle`,
          price: 0, // Kept for backward compatibility
          priceCustomer: 0,
          priceAgent: 0,
          priceWholesaler: 0,
          priceDealer: 0,
          dataAmount: plan.dataAmount,
          validity: 90, // 90 days validity
          network: 'MTN',
          isActive: true,
        },
      })
    }
  }

  // Create AT Bigtime (AirtelTigo) data plans
  const atBigtimeDataPlans = [
    { name: 'AirtelTigo Bigtime 30GB', dataAmount: 30720 },    // 30GB in MB
    { name: 'AirtelTigo Bigtime 40GB', dataAmount: 40960 },    // 40GB in MB
    { name: 'AirtelTigo Bigtime 50GB', dataAmount: 51200 },    // 50GB in MB
    { name: 'AirtelTigo Bigtime 60GB', dataAmount: 61440 },    // 60GB in MB
    { name: 'AirtelTigo Bigtime 80GB', dataAmount: 81920 },    // 80GB in MB
    { name: 'AirtelTigo Bigtime 100GB', dataAmount: 102400 },  // 100GB in MB
    { name: 'AirtelTigo Bigtime 200GB', dataAmount: 204800 },  // 200GB in MB
    { name: 'AirtelTigo Bigtime 250GB', dataAmount: 256000 },  // 250GB in MB
    { name: 'AirtelTigo Bigtime 400GB', dataAmount: 409600 },   // 400GB in MB
    { name: 'AirtelTigo Bigtime 500GB', dataAmount: 512000 },   // 500GB in MB
  ]

  console.log('Creating AT Bigtime data plans...')
  for (const plan of atBigtimeDataPlans) {
    // Check if plan already exists
    const existingPlan = await prisma.dataPlan.findFirst({
      where: {
        name: plan.name,
        network: 'AirtelTigo BIGTIME',
      },
    })

    if (existingPlan) {
      // Update existing plan but preserve prices
      await prisma.dataPlan.update({
        where: { id: existingPlan.id },
        data: {
          description: `${plan.dataAmount / 1024}GB AirtelTigo Bigtime data bundle`,
          dataAmount: plan.dataAmount,
          validity: 900, // 900 days validity
          isActive: true,
          // Keep existing prices
        },
      })
    } else {
      // Create new plan with zero prices (admin will set role prices manually)
      await prisma.dataPlan.create({
        data: {
          name: plan.name,
          description: `${plan.dataAmount / 1024}GB AirtelTigo Bigtime data bundle`,
          price: 0, // Kept for backward compatibility
          priceCustomer: 0,
          priceAgent: 0,
          priceWholesaler: 0,
          priceDealer: 0,
          dataAmount: plan.dataAmount,
          validity: 900, // 900 days validity
          network: 'AirtelTigo BIGTIME',
          isActive: true,
        },
      })
    }
  }

  // Create AT Data (AirtelTigo) data plans
  const atDataPlans = [
    { name: 'AirtelTigo iShare 1GB', dataAmount: 1024 },      // 1GB in MB
    { name: 'AirtelTigo iShare 2GB', dataAmount: 2048 },      // 2GB in MB
    { name: 'AirtelTigo iShare 3GB', dataAmount: 3072 },      // 3GB in MB
    { name: 'AirtelTigo iShare 4GB', dataAmount: 4096 },      // 4GB in MB
    { name: 'AirtelTigo iShare 5GB', dataAmount: 5120 },      // 5GB in MB
    { name: 'AirtelTigo iShare 6GB', dataAmount: 6144 },      // 6GB in MB
    { name: 'AirtelTigo iShare 7GB', dataAmount: 7168 },      // 7GB in MB
    { name: 'AirtelTigo iShare 8GB', dataAmount: 8192 },      // 8GB in MB
    { name: 'AirtelTigo iShare 9GB', dataAmount: 9216 },      // 9GB in MB
    { name: 'AirtelTigo iShare 10GB', dataAmount: 10240 },    // 10GB in MB
    { name: 'AirtelTigo iShare 12GB', dataAmount: 12288 },    // 12GB in MB
    { name: 'AirtelTigo iShare 15GB', dataAmount: 15360 },    // 15GB in MB
    { name: 'AirtelTigo iShare 20GB', dataAmount: 20480 },    // 20GB in MB
  ]

  console.log('Creating AT Data plans...')
  for (const plan of atDataPlans) {
    // Check if plan already exists
    const existingPlan = await prisma.dataPlan.findFirst({
      where: {
        name: plan.name,
        network: 'AirtelTigo ISHARE',
      },
    })

    if (existingPlan) {
      // Update existing plan but preserve prices
      await prisma.dataPlan.update({
        where: { id: existingPlan.id },
        data: {
          description: `${plan.dataAmount / 1024}GB AirtelTigo Data bundle`,
          dataAmount: plan.dataAmount,
          validity: 90,
          isActive: true,
          // Keep existing prices
        },
      })
    } else {
      // Create new plan with zero prices (admin will set role prices manually)
      await prisma.dataPlan.create({
        data: {
          name: plan.name,
          description: `${plan.dataAmount / 1024}GB AirtelTigo Data bundle`,
          price: 0, // Kept for backward compatibility
          priceCustomer: 0,
          priceAgent: 0,
          priceWholesaler: 0,
          priceDealer: 0,
          dataAmount: plan.dataAmount,
          validity: 90, // 90 days validity
          network: 'AirtelTigo ISHARE',
          isActive: true,
        },
      })
    }
  }

  // Create Telecel data plans
  const telecelDataPlans = [
    { name: 'Telecel 5GB', dataAmount: 5120 },      // 5GB in MB
    { name: 'Telecel 8GB', dataAmount: 8192 },      // 8GB in MB
    { name: 'Telecel 10GB', dataAmount: 10240 },    // 10GB in MB
    { name: 'Telecel 15GB', dataAmount: 15360 },    // 15GB in MB
    { name: 'Telecel 20GB', dataAmount: 20480 },    // 20GB in MB
    { name: 'Telecel 25GB', dataAmount: 25600 },    // 25GB in MB
    { name: 'Telecel 30GB', dataAmount: 30720 },    // 30GB in MB
    { name: 'Telecel 40GB', dataAmount: 40960 },    // 40GB in MB
    { name: 'Telecel 50GB', dataAmount: 51200 },    // 50GB in MB
    { name: 'Telecel 100GB', dataAmount: 102400 },  // 100GB in MB
  ]

  console.log('Creating Telecel data plans...')
  for (const plan of telecelDataPlans) {
    // Check if plan already exists
    const existingPlan = await prisma.dataPlan.findFirst({
      where: {
        name: plan.name,
        network: 'TELECEL',
      },
    })

    if (existingPlan) {
      // Update existing plan but preserve prices
      await prisma.dataPlan.update({
        where: { id: existingPlan.id },
        data: {
          description: `${plan.dataAmount / 1024}GB Telecel data bundle`,
          dataAmount: plan.dataAmount,
          validity: 60,
          isActive: true,
          // Keep existing prices
        },
      })
    } else {
      // Create new plan with zero prices (admin will set role prices manually)
      await prisma.dataPlan.create({
        data: {
          name: plan.name,
          description: `${plan.dataAmount / 1024}GB Telecel data bundle`,
          price: 0, // Kept for backward compatibility
          priceCustomer: 0,
          priceAgent: 0,
          priceWholesaler: 0,
          priceDealer: 0,
          dataAmount: plan.dataAmount,
          validity: 60, // 60 days validity
          network: 'TELECEL',
          isActive: true,
        },
      })
    }
  }

  // Verify networks exist
  const allNetworks = await prisma.network.findMany()
  const allDataPlans = await prisma.dataPlan.findMany()
  
  console.log('Database seeded successfully!')
  console.log('\n=== Networks Created ===')
  allNetworks.forEach(network => {
    console.log(`- ${network.name} (${network.isActive ? 'Active' : 'Inactive'})`)
  })
  console.log('\n=== Data Plans Created ===')
  console.log(`- ${mtnDataPlans.length} MTN data plans (network: MTN)`)
  console.log(`- ${atBigtimeDataPlans.length} AirtelTigo Bigtime data plans (network: AirtelTigo BIGTIME)`)
  console.log(`- ${atDataPlans.length} AirtelTigo Data plans (network: AirtelTigo ISHARE)`)
  console.log(`- ${telecelDataPlans.length} Telecel data plans (network: TELECEL)`)
  console.log(`\nTotal: ${allDataPlans.length} data plans linked to ${allNetworks.length} networks`)
  console.log('\nNote: Role prices are set to 0. Admin must set prices for Customer, Agent, Wholesaler, and Dealer roles through the dashboard.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


  // run with: npx prisma db seed