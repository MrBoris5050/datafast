import { NextResponse } from 'next/server'
import { getAllVoucherPricing } from '@/lib/voucher-pricing'

export async function GET() {
  try {
    const pricing = await getAllVoucherPricing()
    return NextResponse.json({ pricing })
  } catch (error) {
    console.error('Error fetching voucher pricing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




