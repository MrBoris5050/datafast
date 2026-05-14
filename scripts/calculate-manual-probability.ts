/**
 * Script to calculate the probability that orders won't be sent to DataHub API
 * and will be marked for manual processing
 * 
 * Usage: npx tsx scripts/calculate-manual-probability.ts [days]
 * Example: npx tsx scripts/calculate-manual-probability.ts 7
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ManualProbabilityStats {
  totalOrders: number
  manualOrders: number
  automaticOrders: number
  manualPercentage: number
  byNetwork: Array<{
    network: string
    total: number
    manual: number
    automatic: number
    manualPercentage: number
  }>
  byStatus: Array<{
    status: string
    total: number
    manual: number
    automatic: number
    manualPercentage: number
  }>
  recentManualOrders: Array<{
    reference: string
    network: string
    planName: string
    status: string
    createdAt: Date
    hasProviderReference: boolean
  }>
}

async function calculateManualProbability(days: number = 7): Promise<ManualProbabilityStats> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  console.log(`\n📊 Calculating manual processing probability for last ${days} days...`)
  console.log(`   Start Date: ${startDate.toISOString()}`)
  console.log(`   End Date: ${new Date().toISOString()}\n`)

  // Get all orders in the period
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate
      }
    },
    include: {
      plan: {
        select: {
          network: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  const totalOrders = orders.length
  const manualOrders = orders.filter(o => o.isManual).length
  const automaticOrders = totalOrders - manualOrders
  const manualPercentage = totalOrders > 0 ? (manualOrders / totalOrders) * 100 : 0

  // Group by network
  const networkMap = new Map<string, { total: number; manual: number }>()
  orders.forEach(order => {
    const network = order.plan.network
    const current = networkMap.get(network) || { total: 0, manual: 0 }
    current.total++
    if (order.isManual) current.manual++
    networkMap.set(network, current)
  })

  const byNetwork = Array.from(networkMap.entries()).map(([network, stats]) => ({
    network,
    total: stats.total,
    manual: stats.manual,
    automatic: stats.total - stats.manual,
    manualPercentage: stats.total > 0 ? (stats.manual / stats.total) * 100 : 0
  })).sort((a, b) => b.total - a.total)

  // Group by status
  const statusMap = new Map<string, { total: number; manual: number }>()
  orders.forEach(order => {
    const status = order.status
    const current = statusMap.get(status) || { total: 0, manual: 0 }
    current.total++
    if (order.isManual) current.manual++
    statusMap.set(status, current)
  })

  const byStatus = Array.from(statusMap.entries()).map(([status, stats]) => ({
    status,
    total: stats.total,
    manual: stats.manual,
    automatic: stats.total - stats.manual,
    manualPercentage: stats.total > 0 ? (stats.manual / stats.total) * 100 : 0
  })).sort((a, b) => b.total - a.total)

  // Get recent manual orders (last 20)
  const recentManualOrders = orders
    .filter(o => o.isManual)
    .slice(0, 20)
    .map(o => ({
      reference: o.reference,
      network: o.plan.network,
      planName: o.plan.name,
      status: o.status,
      createdAt: o.createdAt,
      hasProviderReference: !!o.providerReference
    }))

  return {
    totalOrders,
    manualOrders,
    automaticOrders,
    manualPercentage,
    byNetwork,
    byStatus,
    recentManualOrders
  }
}

async function printStats(stats: ManualProbabilityStats) {
  console.log('='.repeat(80))
  console.log('📈 MANUAL PROCESSING PROBABILITY ANALYSIS')
  console.log('='.repeat(80))
  
  console.log(`\n📊 Overall Statistics:`)
  console.log(`   Total Orders:        ${stats.totalOrders.toLocaleString()}`)
  console.log(`   Manual Orders:       ${stats.manualOrders.toLocaleString()} (${stats.manualPercentage.toFixed(2)}%)`)
  console.log(`   Automatic Orders:    ${stats.automaticOrders.toLocaleString()} (${(100 - stats.manualPercentage).toFixed(2)}%)`)
  
  if (stats.totalOrders > 0) {
    console.log(`\n🎯 Probability: ${stats.manualPercentage.toFixed(2)}% of orders are marked for manual processing`)
    console.log(`   This means approximately ${(stats.manualPercentage / 100).toFixed(4)} or 1 in every ${Math.round(100 / stats.manualPercentage)} orders will be manual`)
  }

  if (stats.byNetwork.length > 0) {
    console.log(`\n📡 By Network:`)
    console.log('   ' + '-'.repeat(76))
    console.log(`   ${'Network'.padEnd(20)} ${'Total'.padStart(10)} ${'Manual'.padStart(10)} ${'Auto'.padStart(10)} ${'Manual %'.padStart(12)}`)
    console.log('   ' + '-'.repeat(76))
    stats.byNetwork.forEach(n => {
      const indicator = n.manualPercentage > 50 ? '🔴' : n.manualPercentage > 10 ? '🟡' : '🟢'
      console.log(`   ${indicator} ${n.network.padEnd(18)} ${n.total.toString().padStart(10)} ${n.manual.toString().padStart(10)} ${n.automatic.toString().padStart(10)} ${n.manualPercentage.toFixed(2).padStart(10)}%`)
    })
  }

  if (stats.byStatus.length > 0) {
    console.log(`\n📋 By Status:`)
    console.log('   ' + '-'.repeat(76))
    console.log(`   ${'Status'.padEnd(20)} ${'Total'.padStart(10)} ${'Manual'.padStart(10)} ${'Auto'.padStart(10)} ${'Manual %'.padStart(12)}`)
    console.log('   ' + '-'.repeat(76))
    stats.byStatus.forEach(s => {
      const indicator = s.manualPercentage > 50 ? '🔴' : s.manualPercentage > 10 ? '🟡' : '🟢'
      console.log(`   ${indicator} ${s.status.padEnd(18)} ${s.total.toString().padStart(10)} ${s.manual.toString().padStart(10)} ${s.automatic.toString().padStart(10)} ${s.manualPercentage.toFixed(2).padStart(10)}%`)
    })
  }

  if (stats.recentManualOrders.length > 0) {
    console.log(`\n🔍 Recent Manual Orders (last ${stats.recentManualOrders.length}):`)
    console.log('   ' + '-'.repeat(76))
    stats.recentManualOrders.forEach(o => {
      const hasRef = o.hasProviderReference ? '✅' : '❌'
      console.log(`   ${o.reference.padEnd(20)} ${o.network.padEnd(15)} ${o.status.padEnd(12)} ${hasRef} ${o.createdAt.toISOString().substring(0, 19)}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 Recommendations:')
  
  if (stats.manualPercentage > 10) {
    console.log('   ⚠️  High manual processing rate detected!')
    console.log('   - Check network configurations in /api/admin/vtu-diagnostics')
    console.log('   - Ensure all networks have active VTU sources')
    console.log('   - Review DataHub API health and error logs')
  } else if (stats.manualPercentage > 5) {
    console.log('   ⚠️  Moderate manual processing rate')
    console.log('   - Review network-specific issues')
    console.log('   - Monitor DataHub API reliability')
  } else {
    console.log('   ✅ Low manual processing rate - system is well configured!')
  }
  
  console.log('='.repeat(80) + '\n')
}

async function main() {
  try {
    const days = process.argv[2] ? parseInt(process.argv[2], 10) : 7
    
    if (isNaN(days) || days < 1) {
      console.error('❌ Invalid number of days. Please provide a positive integer.')
      console.log('Usage: npx tsx scripts/calculate-manual-probability.ts [days]')
      process.exit(1)
    }

    const stats = await calculateManualProbability(days)
    await printStats(stats)
  } catch (error: any) {
    console.error('\n❌ Error calculating manual probability:', error)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

