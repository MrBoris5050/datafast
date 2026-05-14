'use client'

import { useSession } from 'next-auth/react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showSearch?: boolean
  onSearch?: (query: string) => void
}

export function DashboardLayout({ 
  children, 
  title, 
  subtitle, 
  showSearch = false, 
  onSearch 
}: DashboardLayoutProps) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-dashboard-pattern flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-dashboard-pattern flex items-center justify-center">
        <div className="text-center glass-card p-8 rounded-2xl border border-slate-700/50">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400">Please sign in to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dashboard-pattern">
      <Sidebar
        userRole={session?.user?.role || 'CUSTOMER'}
        userName={session?.user?.name}
        userEmail={session?.user?.email}
      />
      <div className="lg:pl-64">
        <Header
          title={title}
          subtitle={subtitle}
          showSearch={showSearch}
          onSearch={onSearch}
        />
        <main className="py-6 sm:py-8 md:py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
