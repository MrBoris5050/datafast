'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DriversLicenseServicePage() {
  return (
    <DashboardLayout title="Driver’s License" subtitle="Chat with us to process your request">
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="border-gray-200 text-gray-700 hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm text-gray-500">Back to Dashboard</span>
        </div>

        <Card className="bg-white border-gray-200 text-gray-900">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-gray-900">Driver’s License Service</CardTitle>
            </div>
            <CardDescription className="text-gray-500">Click the button below to chat with our team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <a href="mailto:support@datafastgh.com" className="inline-flex">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <MessageCircle className="h-4 w-4 mr-2" /> Chat with Support
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}


