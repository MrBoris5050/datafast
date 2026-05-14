'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  Home,
  Users,
  Wifi,
  ShoppingCart,
  BarChart3,
  Settings,
  Bell,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronRight,
  CreditCard,
  Key,
  Ticket,
  UserCheck,
  Trophy,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface AdminSidebarProps {
  userName?: string
  userEmail?: string
  userImage?: string
}

const adminNavItems = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
    description: 'Overview and analytics'
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Manage platform users',
  },
  {
    name: 'User Analytics',
    href: '/admin/user-analytics',
    icon: UserCheck,
    description: 'User insights & growth',
  },
  // {
  //   name: 'Top Sellers',
  //   href: '/admin/top-sellers',
  //   icon: Trophy,
  //   description: 'Users with most sales',
  // },
  {
    name: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    description: 'Monitor transactions',
  },
  {
    name: 'Data Plans',
    href: '/admin/data-plans',
    icon: Wifi,
    description: 'Configure data bundles',
  },
  // {
  //   name: 'Network providers',
  //   href: '/admin/vtu-sources',
  //   icon: Wifi,
  //   description: 'Manage VTU API providers',
  // },
  {
    name: 'Networks',
    href: '/admin/networks',
    icon: Wifi,
    description: 'Manage supported networks',
  },
  {
    name: 'API Keys',
    href: '/admin/users-api-keys',
    icon: Key,
    description: 'View users and manage API keys',
  },
  {
    name: 'Vouchers',
    href: '/admin/vouchers',
    icon: Ticket,
    description: 'Manage BECE & WASSCE vouchers',
  },
  // {
  //   name: 'Transactions',
  //   href: '/admin/transactions',
  //   icon: CreditCard,
  //   description: 'View all transactions',
  // },
  // {
  //   name: 'Analytics',
  //   href: '/admin/analytics',
  //   icon: BarChart3,
  //   description: 'Performance metrics'
  // },
  {
    name: 'Reports',
    href: '/admin/reports',
    icon: FileText,
    description: 'Generate reports'
  },
  // {
  //   name: 'Notifications',
  //   href: '/admin/notifications',
  //   icon: Bell,
  //   description: 'System notifications',
  // },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Platform configuration'
  }
]


export function AdminSidebar({ userName, userEmail, userImage }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [counts, setCounts] = useState<{ users?: number; plans?: number; orders?: number; notifications?: number }>({})
  const pathname = usePathname()

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(item => item !== itemName)
        : [...prev, itemName]
    )
  }

  const getInitials = (name?: string) => {
    if (!name) return 'A'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/summary', { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) {
          setCounts({
            users: data.data.users,
            plans: data.data.plans,
            orders: data.data.orders.PROCESSING || 0,
            notifications: 0,
          })
        }
      } catch {}
    }
    load()
  }, [])

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white backdrop-blur-md border-gray-300 text-black hover:bg-gray-50 h-10 w-10 shadow-lg"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-screen w-48 sm:w-52 overflow-y-auto no-scrollbar transform transition-transform duration-300 ease-in-out",
        "bg-gradient-to-b from-blue-50 via-white to-red-50 backdrop-blur-xl",
        "border-r border-gray-200 shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:fixed lg:z-40"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md overflow-hidden bg-white">
                  <Image 
                    src="/logo.jpg" 
                    alt="datafast Logo" 
                    width={32} 
                    height={32} 
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white"></div>
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-sm bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
                  Datafast
                </h1>
                <p className="text-gray-600 text-xs">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="p-3 border-b border-gray-200">
            <div className="bg-gray-50 backdrop-blur-md rounded-lg p-2.5 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2">
                <Avatar className="h-9 w-9 ring-1 ring-gray-200">
                  <AvatarImage src={userImage || ''} alt={userName || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-red-500 text-white text-xs font-bold">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold truncate text-xs">{userName || 'Admin User'}</p>
                  <p className="text-gray-600 text-xs truncate">{userEmail || 'admin@inventordatahub.com'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <nav className="space-y-0.5">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between px-2.5 py-2 rounded-lg transition-all duration-200 relative overflow-hidden",
                      active
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {active && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-red-600/20 blur-xl"></div>
                    )}
                    <div className="flex items-center space-x-2 relative z-10">
                      <div className={cn(
                        "p-1 rounded-md transition-colors",
                        active ? "bg-white/20" : "bg-gray-100 group-hover:bg-gray-200"
                      )}>
                        <Icon className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          active ? "text-white" : "text-gray-600 group-hover:text-gray-900 group-hover:scale-110"
                        )} />
                      </div>
                      <span className={cn(
                        "font-medium text-xs block truncate",
                        active ? "text-white" : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 relative z-10">
                      {item.name === 'Users' && counts.users !== undefined && (
                        <Badge className={cn(
                          "text-[10px] px-1.5 py-0",
                          active 
                            ? "bg-white/20 text-white border-white/30" 
                            : "bg-gray-200 text-gray-700 border-gray-300"
                        )}>
                          {counts.users}
                        </Badge>
                      )}
                      {item.name === 'Data Plans' && counts.plans !== undefined && (
                        <Badge className={cn(
                          "text-[10px] px-1.5 py-0",
                          active 
                            ? "bg-white/20 text-white border-white/30" 
                            : "bg-gray-200 text-gray-700 border-gray-300"
                        )}>
                          {counts.plans}
                        </Badge>
                      )}
                      {item.name === 'Orders' && counts.orders !== undefined && (
                        <Badge className={cn(
                          "text-[10px] px-1.5 py-0",
                          active 
                            ? "bg-white/20 text-white border-white/30" 
                            : "bg-gray-200 text-gray-700 border-gray-300"
                        )}>
                          {counts.orders}
                        </Badge>
                      )}
                      <ChevronRight className={cn(
                        "h-3 w-3 transition-transform",
                        active ? "text-white rotate-90" : "text-gray-500 group-hover:text-gray-700 group-hover:translate-x-0.5"
                      )} />
                    </div>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200">
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 group h-8"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <div className="p-1 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors mr-2">
                <LogOut className="h-3.5 w-3.5 text-red-600 group-hover:text-red-700" />
              </div>
              <span className="text-xs font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
