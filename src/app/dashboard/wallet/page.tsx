'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Wallet, ArrowLeft, CreditCard, Clock, RefreshCw, History, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'

type PendingTransaction = {
  id: string
  reference: string
  type: string
  amount: number
  status: string
  description: string
  createdAt: string
}

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

function WalletPageInner() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([])
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [walletHistoryPage, setWalletHistoryPage] = useState(1)
  const [walletHistoryPagination, setWalletHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loadingHistory, setLoadingHistory] = useState(false)
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

  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setWalletBalance(Number(data?.data?.walletBalance ?? 0))
      } catch {}
    }

    const fetchPendingTransactions = async () => {
      try {
        const res = await fetch('/api/transactions/list?limit=100', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        // Filter for pending TOPUP transactions that are less than 1 hour old
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const pending = (data?.data || []).filter(
          (tx: PendingTransaction) => {
            if (tx.type !== 'TOPUP' || tx.status !== 'PENDING') return false
            const txDate = new Date(tx.createdAt)
            return txDate > oneHourAgo // Only show if created less than 1 hour ago
          }
        )
        if (!cancelled) setPendingTransactions(pending)
      } catch {}
    }

    const load = async () => {
      await Promise.all([fetchBalance(), fetchPendingTransactions()])
    }
    load()
    return () => { cancelled = true }
  }, [session?.user?.id])

  // Fetch wallet history with pagination and filters
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false

    const fetchWalletHistory = async () => {
      setLoadingHistory(true)
      try {
        const dateRange = getDateRange()
        const params = new URLSearchParams({
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
        
        const res = await fetch(`/api/transactions/list?${params.toString()}`, { cache: 'no-store' })
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
  }, [session?.user?.id, walletHistoryPage, transactionTypeFilter, dateRangeFilter, customStartDate, customEndDate])

  const handleTopup = async () => {
    setError('')
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (value < 5) {
      setError('Minimum topup amount is ₵5')
      return
    }
    if (!session?.user?.id) {
      setError('You must be signed in')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/wallet/topup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, amount: value }),
      })
      const data = await res.json()
      if (!res.ok || !data?.data?.authorizationUrl) {
        throw new Error(data?.error || 'Failed to initialize top-up')
      }
      window.location.href = data.data.authorizationUrl
    } catch (e: any) {
      setError(e.message || 'Failed to initialize top-up')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (reference: string) => {
    setVerifyingRef(reference)
    try {
      const res = await fetch('/api/wallet/topup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      })
      const data = await res.json()
      
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Verification failed')
      }

      toast({
        title: "Success",
        description: "Payment verified! Your wallet has been credited.",
      })

      // Refresh balance and pending transactions
      const fetchBalance = async () => {
        try {
          const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          setWalletBalance(Number(data?.data?.walletBalance ?? 0))
        } catch {}
      }

      const fetchPendingTransactions = async () => {
        try {
          const res = await fetch('/api/transactions/list', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          // Filter for pending TOPUP transactions that are less than 1 hour old
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          const pending = (data?.data || []).filter(
            (tx: PendingTransaction) => {
              if (tx.type !== 'TOPUP' || tx.status !== 'PENDING') return false
              const txDate = new Date(tx.createdAt)
              return txDate > oneHourAgo // Only show if created less than 1 hour ago
            }
          )
          setPendingTransactions(pending)
        } catch {}
      }

      await Promise.all([fetchBalance(), fetchPendingTransactions()])
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || 'Failed to verify payment',
        variant: "destructive"
      })
    } finally {
      setVerifyingRef(null)
    }
  }

  // Handle Paystack redirect - auto-verify payment if redirected from Paystack
  useEffect(() => {
    const reference = searchParams.get('reference')
    const status = searchParams.get('status')

    // If redirected from Paystack with success status, auto-verify
    if (reference && status === 'success' && !verifyingRef) {
      // Clean up URL by removing query parameters
      router.replace('/dashboard/wallet', { scroll: false })
      
      // Auto-verify the payment
      handleVerify(reference)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router])

  return (
    <DashboardLayout title="Wallet">
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs sm:text-sm text-gray-500">Back to Dashboard</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Wallet Balance Card */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-gray-900">Current Balance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {walletBalance === null ? '—' : `₵${walletBalance.toLocaleString('en-US')}`}
              </div>
              <p className="text-gray-500 text-sm">Available funds</p>
            </CardContent>
          </Card>

          {/* Top-up Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <div className="w-5 h-5 relative">
                    <Image 
                      src="/logo.jpg" 
                      alt="Logo" 
                      width={20} 
                      height={20} 
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                </div>
                <CardTitle className="text-gray-900">Add Wallet Funds</CardTitle>
              </div>
              <CardDescription className="text-gray-500">
                Enter an amount in Ghana Cedi and pay securely with Paystack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-600">{error}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="amount" className="text-gray-700">Amount (₵)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="5"
                  className="mt-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50"
                />
              </div>
              <Button 
                onClick={handleTopup} 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay with Paystack
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center">Funds will be added after payment verification</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Transactions */}
        {pendingTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <CardTitle className="text-gray-900">Pending Top-ups</CardTitle>
              </div>
              <CardDescription className="text-gray-500">
                Verify your payments to credit your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 mb-3 sm:mb-0">
                      <div className="flex items-center space-x-2 mb-1">
                          <Badge className="bg-yellow-50 text-yellow-600 border-0">
                          Pending
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">
                          ₵{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{tx.description}</p>
                      <p className="text-xs text-gray-400 font-mono">Ref: {tx.reference}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleVerify(tx.reference)}
                      disabled={verifyingRef === tx.reference}
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      {verifyingRef === tx.reference ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Verify Payment
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <History className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Wallet History</CardTitle>
                  <CardDescription className="text-gray-500">
                    Your wallet transaction history
                  </CardDescription>
                </div>
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
                    <SelectTrigger id="transaction-type">
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
                    <SelectTrigger id="date-range">
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
                >
                  Clear Filters
                </Button>
              )}
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading history...</span>
              </div>
            ) : walletTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No wallet transactions yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {walletTransactions.map((tx) => {
                    const isCredit = tx.type === 'TOPUP' || tx.type === 'CREDIT'
                    const isDebit = tx.type === 'PURCHASE' || tx.type === 'DEBIT'
                    const showBalance = tx.status === 'COMPLETED'
                    
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
                                    ? 'bg-emerald-50 text-emerald-600 border-0'
                                    : tx.status === 'PENDING'
                                    ? 'bg-yellow-50 text-yellow-600 border-0'
                                    : 'bg-red-50 text-red-600 border-0'
                                }
                              >
                                {tx.status}
                              </Badge>
                              <Badge variant="outline" className="border-gray-200 text-gray-600">
                                {tx.type}
                              </Badge>
                              <span
                                className={`text-sm font-semibold ${
                                  isCredit ? 'text-emerald-600' : isDebit ? 'text-red-600' : 'text-gray-900'
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
                          <div className="flex items-center space-x-4 text-xs text-gray-500 bg-gray-100 rounded p-2 mb-2">
                            <div>
                              <span className="text-gray-400">Before: </span>
                              <span className="font-medium text-gray-700">₵{tx.balanceBefore.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div>
                              <span className="text-gray-400">After: </span>
                              <span className="font-medium text-gray-700">₵{tx.balanceAfter.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-400">
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
                    <div className="text-sm text-gray-500">
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
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-500">
                        Page {walletHistoryPage} of {walletHistoryPagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalletHistoryPage((p) => Math.min(walletHistoryPagination.totalPages, p + 1))}
                        disabled={walletHistoryPage === walletHistoryPagination.totalPages || loadingHistory}
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
    </DashboardLayout>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="Wallet">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
      </DashboardLayout>
    }>
      <WalletPageInner />
    </Suspense>
  )
}
