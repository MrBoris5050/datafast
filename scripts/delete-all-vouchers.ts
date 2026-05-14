import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllVouchers() {
  try {
    console.log('⚠️  WARNING: This will delete ALL vouchers and voucher purchases from the system!')
    console.log('Starting voucher deletion process...\n')

    // Count vouchers and purchases before deletion
    const voucherCount = await prisma.voucher.count()
    const purchaseCount = await prisma.voucherPurchase.count()

    console.log(`Found ${voucherCount} vouchers and ${purchaseCount} voucher purchases`)

    if (voucherCount === 0 && purchaseCount === 0) {
      console.log('No vouchers or purchases found. Nothing to delete.')
      return
    }

    // Delete voucher purchases first (though cascade will handle this, doing it explicitly for clarity)
    console.log('\nDeleting voucher purchases...')
    const deletedPurchases = await prisma.voucherPurchase.deleteMany({})
    console.log(`✓ Deleted ${deletedPurchases.count} voucher purchases`)

    // Delete all vouchers
    console.log('\nDeleting vouchers...')
    const deletedVouchers = await prisma.voucher.deleteMany({})
    console.log(`✓ Deleted ${deletedVouchers.count} vouchers`)

    // Verify deletion
    const remainingVouchers = await prisma.voucher.count()
    const remainingPurchases = await prisma.voucherPurchase.count()

    console.log('\n=== Deletion Summary ===')
    console.log(`Vouchers deleted: ${deletedVouchers.count}`)
    console.log(`Purchases deleted: ${deletedPurchases.count}`)
    console.log(`Remaining vouchers: ${remainingVouchers}`)
    console.log(`Remaining purchases: ${remainingPurchases}`)

    if (remainingVouchers === 0 && remainingPurchases === 0) {
      console.log('\n✅ Successfully deleted all vouchers and purchases!')
    } else {
      console.log('\n⚠️  Warning: Some records may still exist')
    }

    // Note: VoucherPricing is NOT deleted as it's just configuration
    const pricingCount = await prisma.voucherPricing.count()
    console.log(`\nNote: Voucher pricing configuration (${pricingCount} records) was preserved.`)
  } catch (error) {
    console.error('\n❌ Error deleting vouchers:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
deleteAllVouchers()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })




