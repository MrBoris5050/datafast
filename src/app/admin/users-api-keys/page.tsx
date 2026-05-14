'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Key,
  ChevronDown,
  MoreHorizontal,
  Loader2,
  XCircle,
  CheckCircle,
  Eye,
  EyeOff,
  AlertCircle,
  Copy,
  Shield,
  Calendar,
  Clock,
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

interface ApiKey {
  id: string
  name: string
  prefix: string
  lastFour: string
  revoked: boolean
  lastUsedAt: string | null
  createdAt: string
  displayKey: string
  fullKey: string | null
}

interface UserWithKeys {
  id: string
  name: string | null
  email: string
  role: UserRole
  phone: string | null
  isActive: boolean
  createdAt: string
  avatar: string | null
  walletBalance: number
  apiKeys: ApiKey[]
  totalApiCalls: number
  totalKeys: number
  activeKeys: number
}

interface PaginationInfo {
  page: number
  limit: number
  totalUsers: number
  totalPages: number
  hasMore: boolean
}

interface StatsInfo {
  totalUsersWithKeys: number
  totalApiKeys: number
  totalActiveApiKeys: number
}

export default function AdminUsersApiKeysPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserWithKeys[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<{ keyId: string; userName: string; keyName: string; revoked: boolean } | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [viewKeyDialogOpen, setViewKeyDialogOpen] = useState(false)
  const [viewingKey, setViewingKey] = useState<{ key: ApiKey; userName: string } | null>(null)
  const [showFullKey, setShowFullKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [stats, setStats] = useState<StatsInfo | null>(null)

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage])

  const fetchData = async (page: number = 1) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/users-api-keys?page=${page}&limit=30`, { cache: 'no-store' })
      const data = await res.json()

      if (res.ok && data.data) {
        setUsers(data.data)
        setPagination(data.pagination)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToPage = (page: number) => {
    if (page >= 1 && (!pagination || page <= pagination.totalPages)) {
      setCurrentPage(page)
      setExpandedUsers(new Set()) // Collapse all users when changing page
    }
  }

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const openRevokeDialog = (keyId: string, userName: string, keyName: string, revoked: boolean) => {
    setSelectedKey({ keyId, userName, keyName, revoked })
    setRevokeDialogOpen(true)
  }

  const openViewKeyDialog = (key: ApiKey, userName: string) => {
    setViewingKey({ key, userName })
    setShowFullKey(false)
    setCopied(false)
    setViewKeyDialogOpen(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevokeKey = async () => {
    if (!selectedKey) return

    setIsRevoking(true)
    try {
      const action = selectedKey.revoked ? 'activate' : 'revoke'
      const res = await fetch(`/api/admin/users-api-keys/${selectedKey.keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to update API key')
        return
      }

      setRevokeDialogOpen(false)
      setSelectedKey(null)
      fetchData()
    } catch (e) {
      alert('Error updating API key')
    } finally {
      setIsRevoking(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery) ||
      user.apiKeys.some((key) =>
        key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.displayKey.toLowerCase().includes(searchQuery.toLowerCase())
      )
    return matchesSearch
  })

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent mb-2">
            Users & API Keys
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            View users and manage their API keys. Monitor API usage and deactivate keys as needed.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Users with API Keys</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">
                  {stats?.totalUsersWithKeys || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Key className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Total API Keys</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">
                  {stats?.totalApiKeys || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Key className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Active API Keys</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">
                  {stats?.totalActiveApiKeys || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 border border-gray-200 shadow-lg mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, or API key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <div className="bg-white backdrop-blur-md rounded-xl p-6 sm:p-8 border border-gray-200 shadow-lg text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading users and API keys...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white backdrop-blur-md rounded-xl p-6 sm:p-8 border border-gray-200 shadow-lg text-center">
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isExpanded = expandedUsers.has(user.id)
              const dateInfo = formatDate(user.createdAt)

              return (
                <div
                  key={user.id}
                  className="bg-white backdrop-blur-md rounded-xl border border-gray-200 shadow-lg overflow-hidden"
                >
                  {/* User Header */}
                  <div
                    className="p-3 sm:p-4 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleUserExpanded(user.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                            {user.name || user.email}
                          </h3>
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                          <span className="truncate">{user.email}</span>
                          {user.phone && <span>• {user.phone}</span>}
                          <span>• Balance: ₵{user.walletBalance.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 ml-4">
                        <div className="text-right">
                          <div className="text-xs sm:text-sm text-gray-600">API Keys</div>
                          <div className="text-base sm:text-lg font-semibold text-gray-900">
                            {user.activeKeys}/{user.totalKeys}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm text-gray-600">API Calls</div>
                          <div className="text-base sm:text-lg font-semibold text-gray-900">
                            {user.totalApiCalls.toLocaleString()}
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            isExpanded ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* API Keys List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {user.apiKeys.length === 0 ? (
                        <div className="p-4 sm:p-6 text-center text-gray-600 text-sm">
                          No API keys found for this user
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {user.apiKeys.map((key) => {
                            const lastUsedInfo = formatDate(key.lastUsedAt)
                            const createdInfo = formatDate(key.createdAt)

                            return (
                              <div
                                key={key.id}
                                className="p-3 sm:p-4 md:p-6 hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                      <h4 className="text-sm sm:text-base font-semibold text-gray-900">
                                        {key.name}
                                      </h4>
                                      <Badge className="bg-green-100 text-green-700 border-green-200">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Active
                                      </Badge>
                                    </div>
                                    <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                                      <div className="flex items-center gap-2">
                                        <Key className="h-3 w-3" />
                                        <span className="font-mono">{key.displayKey}</span>
                                      </div>
                                      <div>
                                        Created:{' '}
                                        {typeof createdInfo === 'object'
                                          ? `${createdInfo.date} ${createdInfo.time}`
                                          : createdInfo}
                                      </div>
                                      <div>
                                        Last Used:{' '}
                                        {typeof lastUsedInfo === 'object'
                                          ? `${lastUsedInfo.date} ${lastUsedInfo.time}`
                                          : lastUsedInfo}
                                      </div>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm"
                                      >
                                        Actions
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                                      <DropdownMenuLabel className="text-gray-900">Actions</DropdownMenuLabel>
                                      <DropdownMenuSeparator className="bg-gray-200" />
                                      <DropdownMenuItem
                                        onClick={() => openViewKeyDialog(key, user.name || user.email)}
                                        className="text-blue-700 hover:bg-blue-50"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Full Key
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openRevokeDialog(
                                            key.id,
                                            user.name || user.email,
                                            key.name,
                                            false
                                          )
                                        }
                                        className="text-red-700 hover:bg-red-50"
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Delete Key
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white backdrop-blur-md rounded-xl p-4 border border-gray-200 shadow-lg mt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalUsers)} of {pagination.totalUsers} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1 || loading}
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        disabled={loading}
                        className={currentPage === pageNum 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages || loading}
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.totalPages)}
                  disabled={currentPage === pagination.totalPages || loading}
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete API Key Dialog */}
        <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Delete API Key</DialogTitle>
              <DialogDescription className="text-gray-600">
                Are you sure you want to delete the API key &quot;{selectedKey?.keyName}&quot; for {selectedKey?.userName}? This action cannot be undone and the key will no longer work for API calls.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRevokeDialogOpen(false)
                  setSelectedKey(null)
                }}
                className="w-full sm:w-auto border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                disabled={isRevoking}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRevokeKey}
                disabled={isRevoking}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              >
                {isRevoking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Key'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View API Key Dialog */}
        <Dialog open={viewKeyDialogOpen} onOpenChange={(open) => { if (!open) { setViewKeyDialogOpen(false); setShowFullKey(false); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-gray-900">
                <Key className="h-5 w-5 text-blue-600" />
                View API Key
              </DialogTitle>
              <DialogDescription>
                Viewing API key for {viewingKey?.userName}
              </DialogDescription>
            </DialogHeader>
            {viewingKey && (
              <div className="space-y-4 mt-2">
                {/* Key Name */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Key className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Key Name</p>
                    <p className="font-semibold text-gray-900">{viewingKey.key.name}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                </div>

                {/* Full API Key */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <p className="text-xs text-gray-500">Full API Key</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-3">
                    <code className="flex-1 text-sm font-mono text-gray-900 break-all">
                      {viewingKey.key.fullKey ? (
                        showFullKey ? viewingKey.key.fullKey : '•'.repeat(Math.min(viewingKey.key.fullKey.length, 40))
                      ) : (
                        viewingKey.key.displayKey
                      )}
                    </code>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {viewingKey.key.fullKey && (
                        <button
                          onClick={() => setShowFullKey(!showFullKey)}
                          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                          title={showFullKey ? 'Hide key' : 'Show key'}
                        >
                          {showFullKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(viewingKey.key.fullKey || viewingKey.key.displayKey)}
                        className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Copy key"
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {viewingKey.key.fullKey ? (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Full key available - click the eye icon to reveal
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Full key not available for older keys
                    </p>
                  )}
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-500" />
                      <p className="text-xs text-gray-500">Created</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(viewingKey.key.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(viewingKey.key.createdAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-gray-500" />
                      <p className="text-xs text-gray-500">Last Used</p>
                    </div>
                    {viewingKey.key.lastUsedAt ? (
                      <>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(viewingKey.key.lastUsedAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(viewingKey.key.lastUsedAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">Never used</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}


