'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, History, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type WalletTransaction = {
  id: string
  reference: string
  type: string
  amount: number
  status: string
  description: string
  createdAt: string
  balanceBefore: number
  balanceAfter: number
}

export default function AdminUserWalletPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  
  const [user, setUser] = useState<{ name: string; email: string; walletBalance: number } | null>(null)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [walletHistoryPage, setWalletHistoryPage] = useState(1)
  const [walletHistoryPagination, setWalletHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL')
  type DateRange = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('TODAY')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Calculate date range based on selection
  const getDateRange = (): { startDate: string; endDate: string } => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    switch (dateRangeFilter) {
      case 'TODAY': {
        const start = new Date(today)
        start.setHours(0, 0, 0, 0)
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }
      }
      case 'THIS_WEEK': {
        const start = new Date(today)
        const dayOfWeek = start.getDay()
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }
      }
      case 'THIS_MONTH': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }
      }
      case 'CUSTOM': {
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate
          }
        }
        // Fallback to today if custom dates not set
        const start = new Date(today)
        start.setHours(0, 0, 0, 0)
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }
      }
      default:
        const start = new Date(today)
        start.setHours(0, 0, 0, 0)
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }
    }
  }

  // Initialize custom dates when switching to CUSTOM mode
  useEffect(() => {
    if (dateRangeFilter === 'CUSTOM' && !customStartDate && !customEndDate) {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today)
      start.setHours(0, 0, 0, 0)
      setCustomStartDate(start.toISOString().split('T')[0])
      setCustomEndDate(today.toISOString().split('T')[0])
    }
  }, [dateRangeFilter])

  // Fetch user info
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const fetchUser = async () => {
      setLoadingUser(true)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && data?.data) {
          setUser({
            name: data.data.name || data.data.email,
            email: data.data.email,
            walletBalance: Number(data.data.walletBalance || 0),
          })
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    }

    fetchUser()
    return () => { cancelled = true }
  }, [userId])

  // Fetch wallet history with pagination and filters
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const fetchWalletHistory = async () => {
      setLoadingHistory(true)
      try {
        const dateRange = getDateRange()
        const params = new URLSearchParams({
          userId: userId,
          page: walletHistoryPage.toString(),
          limit: '20',
        })
        
        if (transactionTypeFilter !== 'ALL') {
          params.append('transactionType', transactionTypeFilter)
        }
        
        if (dateRange.startDate) {
          params.append('startDate', dateRange.startDate)
        }
        
        if (dateRange.endDate) {
          params.append('endDate', dateRange.endDate)
        }
        
        const res = await fetch(`/api/admin/transactions/list?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && data?.data) {
          setWalletTransactions(data.data)
          if (data.pagination) {
            setWalletHistoryPagination(data.pagination)
          }
        }
      } catch (error) {
        console.error('Error fetching wallet history:', error)
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    fetchWalletHistory()
    return () => { cancelled = true }
  }, [userId, walletHistoryPage, transactionTypeFilter, dateRangeFilter, customStartDate, customEndDate])

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/admin/users">
              <Button variant="outline" size="icon" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-50">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wallet History</h1>
              {user && (
                <p className="text-gray-900">
                  {user.name} ({user.email})
                </p>
              )}
            </div>
          </div>
          
          {user && (
            <Card className="bg-gradient-to-br from-blue-50 to-red-50 backdrop-blur-md border-gray-200 shadow-xl mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 text-sm mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-gray-900">₵{user.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-white backdrop-blur-md border-gray-200 shadow-xl">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Transaction History</CardTitle>
                <CardDescription className="text-gray-900">
                  Wallet transaction history with balance tracking
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transaction-type" className="text-gray-700 mb-2 block">Transaction Type</Label>
                  <Select value={transactionTypeFilter} onValueChange={(value: 'ALL' | 'CREDIT' | 'DEBIT') => {
                    setTransactionTypeFilter(value)
                    setWalletHistoryPage(1)
                  }}>
                    <SelectTrigger id="transaction-type" className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Transactions</SelectItem>
                      <SelectItem value="CREDIT">Credits (Top-up)</SelectItem>
                      <SelectItem value="DEBIT">Debits (Purchases)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date-range" className="text-gray-700 mb-2 block">Date Range</Label>
                  <Select value={dateRangeFilter} onValueChange={(value: DateRange) => {
                    setDateRangeFilter(value)
                    setWalletHistoryPage(1)
                  }}>
                    <SelectTrigger id="date-range" className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAY">Today</SelectItem>
                      <SelectItem value="THIS_WEEK">This Week</SelectItem>
                      <SelectItem value="THIS_MONTH">This Month</SelectItem>
                      <SelectItem value="CUSTOM">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {dateRangeFilter === 'CUSTOM' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-start-date" className="text-gray-700 mb-2 block">Start Date</Label>
                    <Input
                      id="custom-start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value)
                        setWalletHistoryPage(1)
                      }}
                      className="bg-white border-gray-300"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-end-date" className="text-gray-700 mb-2 block">End Date</Label>
                    <Input
                      id="custom-end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value)
                        setWalletHistoryPage(1)
                      }}
                      className="bg-white border-gray-300"
                    />
                  </div>
                </div>
              )}
              {(transactionTypeFilter !== 'ALL' || dateRangeFilter !== 'TODAY') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTransactionTypeFilter('ALL')
                    setDateRangeFilter('TODAY')
                    setCustomStartDate('')
                    setCustomEndDate('')
                    setWalletHistoryPage(1)
                  }}
                  className="border-gray-300"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading history...</span>
              </div>
            ) : walletTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No wallet transactions found</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {walletTransactions.map((tx) => {
                    const isCredit = tx.type === 'TOPUP' || tx.type === 'CREDIT'
                    const isDebit = tx.type === 'PURCHASE' || tx.type === 'DEBIT'
                    const showBalance = tx.status === 'COMPLETED' && tx.balanceBefore !== undefined && tx.balanceAfter !== undefined
                    
                    return (
                      <div
                        key={tx.id}
                        className="flex flex-col p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge
                                className={
                                  tx.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : tx.status === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                    : 'bg-red-100 text-red-700 border-red-200'
                                }
                              >
                                {tx.status}
                              </Badge>
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                {tx.type}
                              </Badge>
                              <span
                                className={`text-sm font-semibold ${
                                  isCredit ? 'text-green-600' : isDebit ? 'text-red-600' : 'text-gray-900'
                                }`}
                              >
                                {isCredit ? '+' : isDebit ? '-' : ''}₵{tx.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">{tx.description}</p>
                          </div>
                        </div>
                        
                        {showBalance && (
                          <div className="flex items-center space-x-4 text-xs text-gray-600 bg-white/50 rounded p-2 mb-2">
                            <div>
                              <span className="text-gray-500">Before: </span>
                              <span className="font-medium">₵{tx.balanceBefore.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div>
                              <span className="text-gray-500">After: </span>
                              <span className="font-medium">₵{tx.balanceAfter.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <p className="font-mono">Ref: {tx.reference}</p>
                          <p>{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {walletHistoryPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing {((walletHistoryPage - 1) * walletHistoryPagination.limit) + 1} to{' '}
                      {Math.min(walletHistoryPage * walletHistoryPagination.limit, walletHistoryPagination.total)} of{' '}
                      {walletHistoryPagination.total} transactions
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalletHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={walletHistoryPage === 1 || loadingHistory}
                        className="border-gray-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {walletHistoryPage} of {walletHistoryPagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalletHistoryPage((p) => Math.min(walletHistoryPagination.totalPages, p + 1))}
                        disabled={walletHistoryPage === walletHistoryPagination.totalPages || loadingHistory}
                        className="border-gray-300"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

