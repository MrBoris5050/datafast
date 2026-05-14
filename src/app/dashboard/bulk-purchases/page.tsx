'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, PackagePlus } from 'lucide-react'

export default function BulkPurchasesPage() {
  return (
    // <DashboardLayout title="Bulk Purchases" subtitle="Place multiple data purchases at once">
    <DashboardLayout title="Bulk Purchases">
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm text-gray-600">Back to Dashboard</span>
        </div>

        <Card className="bg-white border-gray-200 text-gray-900">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <PackagePlus className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-gray-900">Upload CSV or Create Batch</CardTitle>
            </div>
            <CardDescription className="text-gray-600">Prepare a list of purchases with phone numbers and plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-600">
              Coming soon — bulk CSV upload and batch purchases.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}


