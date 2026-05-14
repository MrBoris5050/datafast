/**
 * Script to analyze why a specific order was marked as manual
 * 
 * Usage:
 *   npx tsx scripts/analyze-order.ts "FS-1764105014750-00XOLI"
 * 
 * Or with environment variables:
 *   DATABASE_URL="..." npx tsx scripts/analyze-order.ts "FS-1764105014750-00XOLI"
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzeOrder(reference: string) {
  console.log(`\n🔍 Analyzing order: ${reference}\n`)
  console.log('=' .repeat(80))

  try {
    // Find the order
    const order = await prisma.order.findUnique({
      where: { reference },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!order) {
      console.error(`❌ Order not found: ${reference}`)
      process.exit(1)
    }

    const network = order.plan.network

    console.log('\n📋 ORDER INFORMATION')
    console.log('-'.repeat(80))
    console.log(`  Reference:     ${order.reference}`)
    console.log(`  Order Number:  ${order.orderNumber || 'N/A'}`)
    console.log(`  Status:         ${order.status}`)
    console.log(`  Is Manual:     ${order.isManual ? '❌ YES' : '✅ NO'}`)
    console.log(`  Amount:        GHS ${Number(order.amount).toFixed(2)}`)
    console.log(`  Phone:         ${order.phone}`)
    console.log(`  Provider Ref:  ${order.providerReference || 'N/A'}`)
    console.log(`  Created:       ${order.createdAt.toISOString()}`)
    console.log(`  Updated:       ${order.updatedAt.toISOString()}`)

    console.log('\n📦 PLAN INFORMATION')
    console.log('-'.repeat(80))
    console.log(`  Plan Name:     ${order.plan.name}`)
    console.log(`  Network:       ${network}`)
    console.log(`  Data Amount:   ${order.plan.dataAmount} MB`)

    console.log('\n👤 USER INFORMATION')
    console.log('-'.repeat(80))
    console.log(`  Name:          ${order.user.name}`)
    console.log(`  Email:         ${order.user.email}`)
    console.log(`  Role:          ${order.user.role}`)

    if (order.payments[0]) {
      console.log('\n💳 PAYMENT INFORMATION')
      console.log('-'.repeat(80))
      console.log(`  Status:        ${order.payments[0].status}`)
      console.log(`  Method:        ${order.payments[0].method}`)
    }

    // Get network-specific setting
    const networkSetting = await prisma.networkApiSetting.findUnique({
      where: { networkName: network },
      include: {
        vtuSource: {
          select: {
            id: true,
            name: true,
            provider: true,
            active: true,
            baseUrl: true,
            isDefault: true
          }
        }
      }
    })

    // Get default VTU source
    const defaultVtuSource = await prisma.vtuSource.findFirst({
      where: { active: true, isDefault: true }
    }) || await prisma.vtuSource.findFirst({ where: { active: true } })

    // Check environment variables
    const DATAHUBGH_API_KEY = process.env.DATAHUBGH_API_KEY
    const DATAHUBGH_BASE_URL = process.env.DATAHUBGH_BASE_URL || 'https://user.datahubgh.com/api'
    const USE_ENV_FOR_VTU = process.env.USE_ENV_FOR_VTU === 'true' || !!DATAHUBGH_API_KEY

    console.log('\n⚙️  CONFIGURATION ANALYSIS')
    console.log('='.repeat(80))

    const issues: string[] = []
    const warnings: string[] = []

    // Check network setting
    if (!networkSetting) {
      issues.push(`❌ No NetworkApiSetting configured for network "${network}"`)
      console.log(`\n❌ Network Setting: NOT CONFIGURED`)
      console.log(`   Network: ${network}`)
      console.log(`   ⚠️  This network has no NetworkApiSetting. Orders will use default VTU source.`)
    } else {
      console.log(`\n✅ Network Setting: CONFIGURED`)
      console.log(`   Network: ${network}`)
      console.log(`   Is Active: ${networkSetting.isActive ? '✅ YES' : '❌ NO'}`)
      console.log(`   VTU Key: ${networkSetting.vtuKey}`)
      console.log(`   VTU Source ID: ${networkSetting.vtuSourceId || 'N/A'}`)

      if (!networkSetting.isActive) {
        issues.push(`❌ Network "${network}" is marked as inactive`)
      }

      if (!networkSetting.vtuSourceId) {
        issues.push(`❌ No VTU source assigned to network "${network}"`)
      } else if (!networkSetting.vtuSource) {
        issues.push(`❌ VTU source ID ${networkSetting.vtuSourceId} not found (may have been deleted)`)
      } else {
        console.log(`\n   VTU Source:`)
        console.log(`     ID: ${networkSetting.vtuSource.id}`)
        console.log(`     Name: ${networkSetting.vtuSource.name}`)
        console.log(`     Provider: ${networkSetting.vtuSource.provider}`)
        console.log(`     Active: ${networkSetting.vtuSource.active ? '✅ YES' : '❌ NO'}`)
        console.log(`     Base URL: ${networkSetting.vtuSource.baseUrl}`)

        if (!networkSetting.vtuSource.active) {
          issues.push(`❌ VTU source "${networkSetting.vtuSource.name}" is inactive`)
        }

        if (networkSetting.vtuSource.provider !== 'DATAHUBGH') {
          warnings.push(`⚠️  VTU source provider is "${networkSetting.vtuSource.provider}", not "DATAHUBGH"`)
        }
      }
    }

    // Check default source
    console.log(`\n📡 Default VTU Source:`)
    if (USE_ENV_FOR_VTU && DATAHUBGH_API_KEY) {
      console.log(`   Source: Environment Variables`)
      console.log(`   Base URL: ${DATAHUBGH_BASE_URL}`)
      console.log(`   API Key: ${DATAHUBGH_API_KEY.substring(0, 10)}...`)
    } else if (defaultVtuSource) {
      console.log(`   Source: Database`)
      console.log(`   ID: ${defaultVtuSource.id}`)
      console.log(`   Name: ${defaultVtuSource.name}`)
      console.log(`   Provider: ${defaultVtuSource.provider}`)
      console.log(`   Active: ${defaultVtuSource.active ? '✅ YES' : '❌ NO'}`)
      console.log(`   Base URL: ${defaultVtuSource.baseUrl}`)

      if (!defaultVtuSource.active) {
        issues.push(`❌ Default VTU source "${defaultVtuSource.name}" is inactive`)
      }
    } else {
      issues.push(`❌ No default VTU source available`)
      console.log(`   ❌ NOT CONFIGURED`)
    }

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('📊 SUMMARY')
    console.log('='.repeat(80))

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ Configuration looks correct!')
      console.log('   The order should have been processed automatically.')
      console.log('   Possible reasons for manual status:')
      console.log('   - DataHubGH API call failed (network error, timeout, etc.)')
      console.log('   - DataHubGH API returned an error response')
      console.log('   - Exception occurred during VTU purchase')
    } else {
      console.log('\n❌ ISSUES FOUND:')
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`)
      })

      if (warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:')
        warnings.forEach((warning, i) => {
          console.log(`   ${i + 1}. ${warning}`)
        })
      }
    }

    // Check order age
    const orderAge = Date.now() - order.createdAt.getTime()
    const orderAgeHours = Math.floor(orderAge / (1000 * 60 * 60))
    const orderAgeMinutes = Math.floor((orderAge % (1000 * 60 * 60)) / (1000 * 60))
    console.log(`\n⏰ Order Age: ${orderAgeHours}h ${orderAgeMinutes}m`)

    // Simulate what would happen now
    console.log('\n🔮 SIMULATION: What would happen if processed now?')
    console.log('-'.repeat(80))
    
    if (networkSetting) {
      if (!networkSetting.isActive) {
        console.log('   ❌ Would be marked as MANUAL (network is inactive)')
      } else if (!networkSetting.vtuSourceId || !networkSetting.vtuSource) {
        console.log('   ❌ Would be marked as MANUAL (no VTU source assigned)')
      } else if (!networkSetting.vtuSource.active) {
        console.log('   ❌ Would be marked as MANUAL (VTU source is inactive)')
      } else {
        console.log('   ✅ Would be processed automatically')
        console.log(`      Using: ${networkSetting.vtuSource.name} (${networkSetting.vtuSource.provider})`)
      }
    } else if (defaultVtuSource && defaultVtuSource.active) {
      console.log('   ✅ Would be processed automatically')
      console.log(`      Using: Default source - ${defaultVtuSource.name} (${defaultVtuSource.provider})`)
    } else if (USE_ENV_FOR_VTU && DATAHUBGH_API_KEY) {
      console.log('   ✅ Would be processed automatically')
      console.log(`      Using: Environment variable configuration`)
    } else {
      console.log('   ❌ Would be marked as MANUAL (no VTU source available)')
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ Analysis complete!\n')

  } catch (error: any) {
    console.error('\n❌ Error analyzing order:', error)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get reference from command line arguments
const reference = process.argv[2]

if (!reference) {
  console.error('❌ Usage: npx tsx scripts/analyze-order.ts <order-reference>')
  console.error('   Example: npx tsx scripts/analyze-order.ts "FS-1764105014750-00XOLI"')
  process.exit(1)
}

analyzeOrder(reference).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

