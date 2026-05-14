'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useNetworks } from '@/hooks/use-networks'
import { Button } from '@/components/ui/button'
import { 
  Home, 
  ShoppingCart, 
  Settings, 
  LogOut,
  Menu,
  X,
  Wifi,
  CreditCard,
  UserCheck,
  Wallet,
  ChevronRight,
  Ticket,
  MessageCircle,
  Phone,
  Sparkles,
  Shield,
  TrendingUp
} from 'lucide-react'
import Image from 'next/image'
import { signOut } from 'next-auth/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole } from '@prisma/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface SidebarProps {
  userRole: UserRole
  userName?: string
  userEmail?: string
}

const customerNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Buy Data', href: '/dashboard/buy-data', icon: Wifi },
  { name: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
  { name: 'Results Checkers', href: '/dashboard/services/result-checker', icon: Ticket },
  { name: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
  // { name: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Settings },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCheck },
]

const DEFAULT_WHATSAPP_URL = 'https://whatsapp.com/channel/0029Vb7pllP7tkjGkUNN6t0N'
const DEFAULT_SUPPORT_PHONE = '+233(0) 245 757 548'

const toTelHref = (phone: string) => {
  const trimmed = phone.trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  return `tel:${hasPlus ? '+' : ''}${digits}`
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [whatsappUrl, setWhatsappUrl] = useState(DEFAULT_WHATSAPP_URL)
  const [supportPhone, setSupportPhone] = useState(DEFAULT_SUPPORT_PHONE)
  const pathname = usePathname()
  const router = useRouter()

  const { networks } = useNetworks()
  const navItems = customerNavItems

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/contact')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (typeof data.whatsappChannelUrl === 'string' && data.whatsappChannelUrl.trim()) {
          setWhatsappUrl(data.whatsappChannelUrl.trim())
        }
        if (typeof data.supportPhone === 'string' && data.supportPhone.trim()) {
          setSupportPhone(data.supportPhone.trim())
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const supportPhoneTel = toTelHref(supportPhone)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'from-red-500 to-pink-500'
      case 'AGENT': return 'from-blue-500 to-cyan-500'
      case 'WHOLESALER':
      case 'DEALER': return 'from-purple-500 to-indigo-500'
      default: return 'from-green-500 to-emerald-500'
    }
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 h-10 w-10 shadow-sm"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 h-screen overflow-y-auto no-scrollbar transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        "bg-white border-r border-gray-200",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5">
                  <div className="w-full h-full rounded-lg bg-white flex items-center justify-center">
                    <Image 
                      src="/logo.jpg" 
                      alt="datafast Logo" 
                      width={32} 
                      height={32} 
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="leading-tight">
                <div className="text-gray-900 font-bold text-sm">datafast</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Platform</div>
              </div>
            </Link>
          </div>

          {/* User info */}
          <div className="p-3 border-b border-gray-200">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="flex items-center space-x-3">
                <Avatar className="h-9 w-9 ring-2 ring-gray-200">
                  <AvatarImage src="" alt={userName || ''} />
                  <AvatarFallback className={cn(
                    "text-white text-xs font-bold bg-gradient-to-br",
                    getRoleColor(userRole)
                  )}>
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold truncate text-sm">{userName || 'User'}</p>
                  <p className="text-gray-400 text-xs truncate">{userEmail || 'user@example.com'}</p>
                  <Badge className={cn(
                    "mt-1.5 text-[10px] px-2 py-0.5 border-0",
                    userRole === 'ADMIN' && "bg-red-100 text-red-600",
                    userRole === 'AGENT' && "bg-blue-100 text-blue-600",
                    (userRole === 'WHOLESALER' || userRole === 'DEALER') && "bg-purple-100 text-purple-600",
                    userRole === 'CUSTOMER' && "bg-emerald-100 text-emerald-600"
                  )}>
                    {userRole.toLowerCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center min-w-0">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors mr-3",
                      isActive ? "bg-white/20" : "bg-gray-100 group-hover:bg-gray-200"
                    )}>
                      <item.icon className={cn(
                        "h-4 w-4",
                        isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                      )} />
                    </div>
                    <span className={cn(
                      "truncate font-medium text-sm",
                      isActive ? "text-white" : "text-gray-700 group-hover:text-gray-900"
                    )}>
                      {item.name}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 transition-all",
                    isActive ? "text-white/70 rotate-90" : "text-gray-300 group-hover:text-gray-400"
                  )} />
                </Link>
              )
            })}

            {/* Admin Panel link */}
            {userRole === 'ADMIN' && (
              <Link
                href="/admin"
                className={cn(
                  "group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 mt-1",
                  pathname.startsWith('/admin')
                    ? "bg-red-600 text-white shadow-sm shadow-red-200"
                    : "text-gray-600 hover:bg-red-50 hover:text-red-700"
                )}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-lg transition-colors mr-3",
                    pathname.startsWith('/admin') ? "bg-white/20" : "bg-red-50 group-hover:bg-red-100"
                  )}>
                    <Shield className={cn(
                      "h-4 w-4",
                      pathname.startsWith('/admin') ? "text-white" : "text-red-400 group-hover:text-red-600"
                    )} />
                  </div>
                  <span className={cn(
                    "truncate font-medium text-sm",
                    pathname.startsWith('/admin') ? "text-white" : "text-gray-700 group-hover:text-red-700"
                  )}>
                    Admin Panel
                  </span>
                </div>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 flex-shrink-0 transition-all",
                  pathname.startsWith('/admin') ? "text-white/70 rotate-90" : "text-gray-300 group-hover:text-red-300"
                )} />
              </Link>
            )}

            {/* Become an Agent — only for regular customers */}
            {userRole === 'CUSTOMER' && (
              <Link
                href="/dashboard/upgrade-to-agent"
                className={cn(
                  "group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 mt-1",
                  pathname === '/dashboard/upgrade-to-agent'
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                )}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-lg transition-colors mr-3",
                    pathname === '/dashboard/upgrade-to-agent' ? "bg-white/20" : "bg-blue-50 group-hover:bg-blue-100"
                  )}>
                    <TrendingUp className={cn(
                      "h-4 w-4",
                      pathname === '/dashboard/upgrade-to-agent' ? "text-white" : "text-blue-500 group-hover:text-blue-600"
                    )} />
                  </div>
                  <span className={cn(
                    "truncate font-medium text-sm",
                    pathname === '/dashboard/upgrade-to-agent' ? "text-white" : "text-gray-700 group-hover:text-blue-700"
                  )}>
                    Become an Agent
                  </span>
                </div>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 flex-shrink-0 transition-all",
                  pathname === '/dashboard/upgrade-to-agent' ? "text-white/70 rotate-90" : "text-gray-300 group-hover:text-blue-300"
                )} />
              </Link>
            )}

            {/* Quick Buy */}
            <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Quick Buy</div>
              </div>
              <Select
                onValueChange={(value) => {
                  router.push(`/dashboard/buy-data?network=${encodeURIComponent(value)}`)
                  setIsOpen(false)
                }}
              >
                <SelectTrigger className="w-full text-sm h-9">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((network) => (
                    <SelectItem key={network.id} value={network.name} className="text-sm">
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </nav>

          {/* Footer Actions */}
          <div className="p-3 border-t border-gray-200 space-y-0.5">
            {/* {whatsappUrl && (
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl h-10 group"
                onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
              >
                <div className="p-1.5 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors mr-3">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium">WhatsApp Community</span>
              </Button>
            )} */}

            {supportPhone && supportPhoneTel && (
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl h-10 group"
                onClick={() => window.open(supportPhoneTel, '_self')}
              >
                <div className="p-1.5 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors mr-3">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{supportPhone}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl h-10 mt-1 group"
              onClick={handleSignOut}
            >
              <div className="p-1.5 rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors mr-3">
                <LogOut className="h-4 w-4 text-red-500" />
              </div>
              <span className="text-sm font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
