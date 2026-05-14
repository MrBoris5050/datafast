'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { ArrowLeft, Search, BarChart3, Trash2 } from 'lucide-react'

type Tx = {
  id: string
  reference: string
  type: string
  amount: number
  status: string
  description: string
  createdAt: string
}

type DateRange = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'

export default function TransactionHistoryPage() {
  const { data: session } = useSession()
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('TODAY')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Calculate date range based on selection
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
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
  }, [dateRangeFilter, customStartDate, customEndDate])

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
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const { startDate, endDate } = getDateRange()
        const params = new URLSearchParams({
          ...(statusFilter !== 'ALL' && { status: statusFilter }),
          startDate,
          endDate,
        })
        
        const res = await fetch(`/api/transactions/list?${params}`, { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (mounted && res.ok && data?.data) setTxs(data.data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [statusFilter, getDateRange])

  const filteredTxs = txs.filter(t => 
    t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase()
    switch (s) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-50 text-emerald-600 border-0">Completed</Badge>
      case 'PENDING':
        return <Badge className="bg-blue-50 text-blue-600 border-0">Pending</Badge>
      case 'PROCESSING':
        return <Badge className="bg-yellow-50 text-yellow-600 border-0">Processing</Badge>
      case 'FAILED':
        return <Badge className="bg-red-50 text-red-600 border-0">Failed</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-500 border-0">{s}</Badge>
    }
  }

  const stats = {
    total: filteredTxs.length,
    completed: filteredTxs.filter(t => t.status === 'COMPLETED').length,
    pending: filteredTxs.filter(t => t.status === 'PENDING').length,
    failed: filteredTxs.filter(t => t.status === 'FAILED').length,
  }

  return (
    <DashboardLayout title="Transaction History">
      <div className="min-h-screen p-2 sm:p-4 lg:p-6">
        <div className="flex items-center space-x-2 sm:space-x-4 mb-4 sm:mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs sm:text-sm text-gray-500">Back to Dashboard</span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Total Transactions</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Completed</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-blue-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Pending</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Failed</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  placeholder="Search by reference, description, type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery('')}
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
            
            {/* Status and Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status-filter" className="text-gray-700 mb-2 block">Order Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date-range" className="text-gray-700 mb-2 block">Date Range</Label>
                <Select value={dateRangeFilter} onValueChange={(value: DateRange) => setDateRangeFilter(value)}>
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
            
            {/* Custom Date Range Inputs */}
            {dateRangeFilter === 'CUSTOM' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-start-date" className="text-gray-700 mb-2 block">Start Date</Label>
                  <Input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="custom-end-date" className="text-gray-700 mb-2 block">End Date</Label>
                  <Input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            {/* Clear Filters Button */}
            {(statusFilter !== 'ALL' || dateRangeFilter !== 'TODAY' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL')
                  setDateRangeFilter('TODAY')
                  setSearchQuery('')
                  setCustomStartDate('')
                  setCustomEndDate('')
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-gray-900 text-base sm:text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loading ? (
              <div className="text-gray-500 text-sm sm:text-base py-8 text-center">Loading transactions...</div>
            ) : filteredTxs.length === 0 ? (
              <div className="rounded-lg border border-gray-200 p-6 sm:p-8 text-center text-gray-500">
                <p className="text-sm sm:text-base">No transactions yet.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTxs.map((t, idx) => (
                        <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[220px]">{t.reference}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{t.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[300px]">{t.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">₵{t.amount.toFixed(2)}</td>
                          <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredTxs.map((t) => (
                    <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600 uppercase">{t.type}</span>
                            {getStatusBadge(t.status)}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                          <p className="text-xs text-gray-400 font-mono truncate mt-1">Ref: {t.reference}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-lg font-bold text-gray-900">₵{t.amount.toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                        {new Date(t.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
