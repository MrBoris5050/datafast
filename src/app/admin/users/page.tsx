'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  CreditCard,
  ChevronDown,
  MoreHorizontal,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserRole } from '@prisma/client'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string
  isActive: boolean
  createdAt: string
  avatar?: string | null
  walletBalance: number
  orderCount: number
}

interface Stats {
  totalTransfers: number
  totalWalletBalance: number
  agentTransfers: number
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats>({ totalTransfers: 0, totalWalletBalance: 0, agentTransfers: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | ''>('')
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('')
  const [isChangingRole, setIsChangingRole] = useState(false)
  const [debitDialogOpen, setDebitDialogOpen] = useState(false)
  const [debitUserId, setDebitUserId] = useState<string | null>(null)
  const [debitUserName, setDebitUserName] = useState<string>('')
  const [debitAmount, setDebitAmount] = useState<string>('')
  const [debitDescription, setDebitDescription] = useState<string>('Admin debit')
  const [currentWalletBalance, setCurrentWalletBalance] = useState<number>(0)
  const [isDebiting, setIsDebiting] = useState(false)
  const [creditDialogOpen, setCreditDialogOpen] = useState(false)
  const [creditUserId, setCreditUserId] = useState<string | null>(null)
  const [creditUserName, setCreditUserName] = useState<string>('')
  const [creditAmount, setCreditAmount] = useState<string>('')
  const [creditDescription, setCreditDescription] = useState<string>('Admin credit')
  const [isCrediting, setIsCrediting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/users/stats', { cache: 'no-store' }),
      ])
      
      const usersData = await usersRes.json()
      const statsData = await statsRes.json()
      
      if (usersRes.ok && usersData.data) {
        setUsers(usersData.data.map((u: any) => ({
          ...u,
          createdAt: u.createdAt,
        })))
      }
      
      if (statsRes.ok && statsData.data) {
        setStats(statsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-red-100 text-red-700 border-red-200">ADMIN</Badge>
      case 'AGENT':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">AGENT</Badge>
      case 'WHOLESALER':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">WHOLESALER</Badge>
      case 'DEALER':
        return <Badge className="bg-green-100 text-green-700 border-green-200">DEALER</Badge>
      case 'CUSTOMER':
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">USER</Badge>
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery)
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
    return matchesSearch && matchesRole
  }).sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const openCreditDialog = (userId: string, userName: string) => {
    setCreditUserId(userId)
    setCreditUserName(userName)
    setCreditAmount('')
    setCreditDescription('Admin credit')
    setCreditDialogOpen(true)
  }

  const handleCreditUser = async () => {
    if (!creditUserId || !creditAmount) return

    const amount = Number(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Invalid amount')
      return
    }

    setIsCrediting(true)
    try {
      const res = await fetch(`/api/admin/users/${creditUserId}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: creditDescription || 'Admin credit' })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to credit user')
        return
      }
      setCreditDialogOpen(false)
      setCreditUserId(null)
      setCreditUserName('')
      setCreditAmount('')
      setCreditDescription('Admin credit')
      alert('Wallet credited successfully')
      fetchData()
    } catch (e) {
      alert('Error crediting user')
    } finally {
      setIsCrediting(false)
    }
  }

  const openDebitDialog = (userId: string, userName: string, walletBalance: number) => {
    setDebitUserId(userId)
    setDebitUserName(userName)
    setCurrentWalletBalance(walletBalance)
    setDebitAmount('')
    setDebitDescription('Admin debit')
    setDebitDialogOpen(true)
  }

  const handleDebitUser = async () => {
    if (!debitUserId || !debitAmount) return
    
    const amount = Number(debitAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Invalid amount')
      return
    }
    
    if (amount > currentWalletBalance) {
      alert(`Insufficient balance. Current balance: ₵${currentWalletBalance.toFixed(2)}`)
      return
    }
    
    setIsDebiting(true)
    try {
      const res = await fetch(`/api/admin/users/${debitUserId}/debit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount, 
          description: debitDescription || 'Admin debit' 
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to debit user')
        return
      }
      setDebitDialogOpen(false)
      setDebitUserId(null)
      setDebitUserName('')
      setDebitAmount('')
      setDebitDescription('Admin debit')
      setCurrentWalletBalance(0)
      alert('Wallet debited successfully')
      fetchData()
    } catch (e) {
      alert('Error debiting user')
    } finally {
      setIsDebiting(false)
    }
  }

  const openRoleDialog = (userId: string, userName: string, currentRole: UserRole) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setCurrentUserRole(currentRole)
    setSelectedRole(currentRole)
    setRoleDialogOpen(true)
  }

  const handleChangeRole = async () => {
    if (!selectedUserId || !selectedRole) return
    
    setIsChangingRole(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to change role')
        return
      }
      setRoleDialogOpen(false)
      setSelectedUserId(null)
      setSelectedUserName('')
      setCurrentUserRole('')
      setSelectedRole('')
      fetchData()
    } catch (e) {
      alert('Error changing role')
    } finally {
      setIsChangingRole(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete user')
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    }
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Total Transfers</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.totalTransfers}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Total Wallet Balance</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">₵{stats.totalWalletBalance.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Transfer Agent Transfers</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.agentTransfers}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 border border-gray-200 shadow-lg mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by name, email, username, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="CUSTOMER">Customer</option>
              <option value="AGENT">Agent</option>
              <option value="WHOLESALER">Wholesaler</option>
              <option value="DEALER">Dealer</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white backdrop-blur-md rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">USER INFO</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CONTACT</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">BALANCE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ROLE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ORDERS</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">JOINED</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const dateInfo = formatDate(user.createdAt)
                    return (
                      <tr key={user.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 font-semibold">{user.name || 'N/A'}</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">{user.email}</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900">{user.phone || 'N/A'}</div>
                          <div className="text-xs sm:text-sm text-gray-500">WhatsApp: {user.phone ? 'Yes' : 'No'}</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 font-semibold">₵{user.walletBalance.toFixed(2)}</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900">{user.orderCount}</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900">{dateInfo.date}</div>
                          <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">{dateInfo.time}</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200 text-xs sm:text-sm">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border-gray-200">
                              <DropdownMenuLabel className="text-gray-900">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-gray-200" />
                              <DropdownMenuItem onClick={() => openCreditDialog(user.id, user.name || user.email)} className="text-gray-700 hover:bg-gray-100">
                                Credit Wallet
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDebitDialog(user.id, user.name || user.email, user.walletBalance)} className="text-gray-700 hover:bg-gray-100">
                                Debit Wallet
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.location.href = `/admin/users/${user.id}/wallet`} className="text-gray-700 hover:bg-gray-100">
                                View Wallet History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRoleDialog(user.id, user.name || user.email, user.role)} className="text-gray-700 hover:bg-gray-100">
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-200" />
                              <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-red-700 hover:bg-red-50">
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Change Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Change User Role</DialogTitle>
              <DialogDescription className="text-gray-600">
                Select a new role for <span className="font-semibold text-gray-900">{selectedUserName}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="grid grid-cols-1 gap-2">
                {(['CUSTOMER', 'AGENT', 'WHOLESALER', 'DEALER', 'ADMIN'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`
                      p-3 rounded-lg border-2 transition-all duration-200 text-left
                      ${selectedRole === role
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{role}</span>
                      {selectedRole === role && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {role === 'CUSTOMER' && <p className="text-xs text-gray-500 mt-1">Standard user account</p>}
                    {role === 'AGENT' && <p className="text-xs text-gray-500 mt-1">Can manage customers and orders</p>}
                    {role === 'WHOLESALER' && <p className="text-xs text-gray-500 mt-1">Bulk purchase capabilities</p>}
                    {role === 'DEALER' && <p className="text-xs text-gray-500 mt-1">Reseller account</p>}
                    {role === 'ADMIN' && <p className="text-xs text-gray-500 mt-1">Full system access</p>}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRoleDialogOpen(false)
                  setSelectedUserId(null)
                  setSelectedUserName('')
                  setCurrentUserRole('')
                  setSelectedRole('')
                }}
                className="w-full sm:w-auto border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                disabled={isChangingRole}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeRole}
                disabled={!selectedRole || isChangingRole || selectedRole === currentUserRole}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isChangingRole ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Role'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credit Wallet Dialog */}
        <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Credit User Wallet</DialogTitle>
              <DialogDescription className="text-gray-900">
                Add funds to <span className="font-semibold text-gray-900">{creditUserName}</span>'s wallet
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <label htmlFor="credit-amount" className="block text-sm font-medium text-gray-900 mb-2">
                  Amount to Credit (₵)
                </label>
                <Input
                  id="credit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label htmlFor="credit-description" className="block text-sm font-medium text-gray-900 mb-2">
                  Description (Optional)
                </label>
                <Input
                  id="credit-description"
                  type="text"
                  value={creditDescription}
                  onChange={(e) => setCreditDescription(e.target.value)}
                  placeholder="Admin credit"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreditDialogOpen(false)
                  setCreditUserId(null)
                  setCreditUserName('')
                  setCreditAmount('')
                  setCreditDescription('Admin credit')
                }}
                className="w-full sm:w-auto border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                disabled={isCrediting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreditUser}
                disabled={!creditAmount || Number(creditAmount) <= 0 || isCrediting}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                {isCrediting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Crediting...
                  </>
                ) : (
                  'Credit Wallet'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Debit Wallet Dialog */}
        <Dialog open={debitDialogOpen} onOpenChange={setDebitDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Debit User Wallet</DialogTitle>
              <DialogDescription className="text-gray-600">
                Debit funds from <span className="font-semibold text-gray-900">{debitUserName}</span>'s wallet
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">₵{currentWalletBalance.toFixed(2)}</p>
              </div>
              <div>
                <label htmlFor="debit-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Debit (₵)
                </label>
                <Input
                  id="debit-amount"
                  type="number"
                  min="0.01"
                  max={currentWalletBalance}
                  step="0.01"
                  value={debitAmount}
                  onChange={(e) => setDebitAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
                {debitAmount && Number(debitAmount) > currentWalletBalance && (
                  <p className="text-xs text-red-600 mt-1">
                    Amount exceeds available balance
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="debit-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <Input
                  id="debit-description"
                  type="text"
                  value={debitDescription}
                  onChange={(e) => setDebitDescription(e.target.value)}
                  placeholder="Admin debit"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              {debitAmount && Number(debitAmount) > 0 && Number(debitAmount) <= currentWalletBalance && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-sm text-gray-600">
                    New balance after debit: <span className="font-semibold text-gray-900">₵{(currentWalletBalance - Number(debitAmount)).toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDebitDialogOpen(false)
                  setDebitUserId(null)
                  setDebitUserName('')
                  setDebitAmount('')
                  setDebitDescription('Admin debit')
                  setCurrentWalletBalance(0)
                }}
                className="w-full sm:w-auto border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                disabled={isDebiting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDebitUser}
                disabled={!debitAmount || Number(debitAmount) <= 0 || Number(debitAmount) > currentWalletBalance || isDebiting}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              >
                {isDebiting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Debiting...
                  </>
                ) : (
                  'Debit Wallet'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  )
}
