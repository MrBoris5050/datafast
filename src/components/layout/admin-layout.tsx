'use client'

import { useSession } from 'next-auth/react'
import { AdminSidebar } from './admin-sidebar'
import { Loader2 } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-admin-gradient flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-admin-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please sign in to access the admin panel.</p>
        </div>
      </div>
    )
  }

  // Check if user is admin
  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-admin-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-admin-gradient">
      <AdminSidebar
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        userImage={session?.user?.image}
      />
      <div className="lg:ml-52 min-h-screen">
        <main className="min-h-screen pt-16 lg:pt-0">
          <div className="px-2 sm:px-4 md:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
