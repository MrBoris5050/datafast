'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Loader2 } from 'lucide-react'

export default function AgentDashboard() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    router.replace('/dashboard')
  }, [status, router])

  return (
    <DashboardLayout title="Redirecting" subtitle="Taking you to your dashboard">
      <div className="flex h-64 items-center justify-center text-gray-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Redirecting to your dashboard...
      </div>
    </DashboardLayout>
  )
}
