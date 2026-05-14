'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  Search, 
  Settings, 
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title?: string
  subtitle?: string
  showSearch?: boolean
  onSearch?: (query: string) => void
  className?: string
}

export function Header({ 
  title, 
  subtitle, 
  showSearch = false, 
  onSearch,
  className 
}: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) onSearch(searchQuery)
  }

  const handleSignOut = () => signOut({ callbackUrl: '/' })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':    return <Badge className="bg-red-100 text-red-600 border-0 text-xs">Admin</Badge>
      case 'AGENT':    return <Badge className="bg-blue-100 text-blue-600 border-0 text-xs">Agent</Badge>
      case 'WHOLESALER': return <Badge className="bg-purple-100 text-purple-600 border-0 text-xs">Wholesaler</Badge>
      case 'DEALER':   return <Badge className="bg-emerald-100 text-emerald-600 border-0 text-xs">Dealer</Badge>
      case 'CUSTOMER': return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Customer</Badge>
      default:         return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">User</Badge>
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <header className={cn(
      "bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm",
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left — Title and Search */}
          <div className="flex items-center space-x-4 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex-1 min-w-0">
              {title && (
                <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 truncate">{subtitle}</p>
              )}
            </div>

            {showSearch && (
              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </form>
            )}
          </div>

          {/* Right — Actions */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-gray-100 ring-2 ring-gray-200">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-sm">
                      {getInitials(session?.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session?.user?.email}
                    </p>
                    <div className="pt-1">
                      {getRoleBadge(session?.user?.role || 'CUSTOMER')}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/dashboard/profile')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-gray-500" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {showSearch && (
          <div className="md:hidden pb-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}
