'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search,
  Hourglass,
  RefreshCw,
  CheckCircle,
  X,
  DollarSign,
  BarChart3,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Calendar,
  FileText,
  Eye,
} from 'lucide-react'
import { formatNetworkName } from '@/lib/utils'
import { OrderLogsDialog } from '@/components/admin/order-logs-dialog'
import { OrderDetailsDialog } from '@/components/admin/order-details-dialog'

interface Order {
  id: string
  orderId: string
  orderNumber?: number
  userId: string
  userName: string
  userEmail: string
  planName: string
  network: string
  dataAmount: number
  amount: number
  phone: string
  reference: string
  status: string
  isManual?: boolean
  createdAt: string
}

interface Stats {
  pending: number
  processing: number
  successful: number
  canceled: number
  refunded: number
  totalTransactions: number
  vtuTransactions: number
  voucherTransactions: number
  agentOrders: number
}

export default function AdminOrdersPage() {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    processing: 0,
    successful: 0,
    canceled: 0,
    refunded: 0,
    totalTransactions: 0,
    vtuTransactions: 0,
    voucherTransactions: 0,
    agentOrders: 0,
  })
  const [todayStats, setTodayStats] = useState<Stats>({
    pending: 0,
    processing: 0,
    successful: 0,
    canceled: 0,
    refunded: 0,
    totalTransactions: 0,
    vtuTransactions: 0,
    voucherTransactions: 0,
    agentOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [networkFilter, setNetworkFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 })
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [selectedOrderForLogs, setSelectedOrderForLogs] = useState<{ id: string; reference: string } | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null)
  
  // Date filter with preset options (default: all time so new orders always appear)
  type DateRange = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('ALL')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Get today's date range (always returns today)
  const getTodayDateRange = (): { startDate: string; endDate: string } => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const start = new Date(today)
    start.setHours(0, 0, 0, 0)
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }
  }

  // Calculate date range based on selection
  const getDateRange = (): { startDate: string; endDate: string } => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    switch (dateRangeFilter) {
      case 'ALL':
        return { startDate: '', endDate: '' }
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

  const { startDate, endDate } = getDateRange()

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

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter, networkFilter, sourceFilter, searchQuery, dateRangeFilter, customStartDate, customEndDate])

  useEffect(() => {
    fetchData()
  }, [page, statusFilter, networkFilter, sourceFilter, searchQuery, dateRangeFilter, customStartDate, customEndDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      const dateRange = getDateRange()
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(networkFilter !== 'ALL' && { network: networkFilter }),
        ...(sourceFilter !== 'ALL' && { source: sourceFilter }),
        ...(searchQuery && { search: searchQuery }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      })
      
      // Build stats params with date filters
      const statsParams = new URLSearchParams({
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      })
      
      // Build today's stats params (always today)
      const todayDateRange = getTodayDateRange()
      const todayStatsParams = new URLSearchParams({
        startDate: todayDateRange.startDate,
        endDate: todayDateRange.endDate,
      })
      
      const [ordersRes, statsRes, todayStatsRes] = await Promise.all([
        fetch(`/api/admin/orders/list?${params}`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/stats?${statsParams}`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/stats?${todayStatsParams}`, { cache: 'no-store' }),
      ])
      
      const ordersData = await ordersRes.json()
      const statsData = await statsRes.json()
      const todayStatsData = await todayStatsRes.json()
      
      if (ordersRes.ok && ordersData.data) {
        setOrders(ordersData.data)
        if (ordersData.pagination) setPagination(ordersData.pagination)
        // Clear selection when data changes
        setSelectedOrders(new Set())
      }
      
      if (statsRes.ok && statsData.data) {
        setStats(statsData.data)
      }
      
      if (todayStatsRes.ok && todayStatsData.data) {
        setTodayStats(todayStatsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setNetworkFilter('ALL')
    setSourceFilter('ALL')
    setDateRangeFilter('ALL')
    setCustomStartDate('')
    setCustomEndDate('')
    setPage(1)
  }

  const formatDataAmount = (mb: number) => {
    if (mb >= 1024) {
      const gb = mb / 1024
      // Show whole number without .0 for whole GB values
      return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`
    }
    return `${mb} MB`
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/update-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to update order status')
        return
      }
      // Update the order status in the local state immediately
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      )
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error updating order status.')
    }
  }

  const handleBulkUpdateStatus = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order')
      return
    }

    if (!bulkStatus) {
      alert('Please select a status')
      return
    }

    try {
      const res = await fetch('/api/admin/orders/bulk-update-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          orderIds: Array.from(selectedOrders),
          status: bulkStatus 
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to bulk update order status')
        return
      }
      // Update the order statuses in the local state immediately
      setOrders(prevOrders => 
        prevOrders.map(order => 
          selectedOrders.has(order.id) ? { ...order, status: bulkStatus } : order
        )
      )
      setSelectedOrders(new Set())
      setBulkStatus('')
    } catch (error) {
      console.error('Error bulk updating order status:', error)
      alert('Error bulk updating order status')
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    }
  }

  const handleExportOrders = async () => {
    try {
      const dateRange = getDateRange()
      const params = new URLSearchParams({
        format: 'csv',
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(networkFilter !== 'ALL' && { network: networkFilter }),
        ...(sourceFilter !== 'ALL' && { source: sourceFilter }),
        ...(searchQuery && { search: searchQuery }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      })

      const res = await fetch(`/api/admin/orders/export?${params}`)
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        alert(error.error || 'Failed to export orders')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting orders:', error)
      alert('Error exporting orders')
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Order Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-orange-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-orange-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Pending Orders</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.pending}</p>
              </div>
              <Hourglass className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-orange-600" />
            </div>
          </div>
          
          <div className="bg-purple-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Processing Orders</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.processing}</p>
              </div>
              <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-green-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-green-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Successful Orders</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.successful}</p>
              </div>
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-pink-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-pink-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Canceled Orders</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.canceled}</p>
              </div>
              <X className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-pink-600" />
            </div>
          </div>
          
          <div className="bg-blue-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Refunded Orders</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.refunded}</p>
              </div>
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <h2 className="text-gray-900 text-base sm:text-lg md:text-xl font-semibold">Transaction Summary</h2>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs w-fit">
              {dateRangeFilter === 'ALL' && 'All time'}
              {dateRangeFilter === 'TODAY' && 'Today'}
              {dateRangeFilter === 'THIS_WEEK' && 'This Week'}
              {dateRangeFilter === 'THIS_MONTH' && 'This Month'}
              {dateRangeFilter === 'CUSTOM' && customStartDate && customEndDate && 
                `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
              }
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Total Transactions</p>
              <p className="text-gray-900 text-lg sm:text-xl md:text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">VTU Transactions</p>
              <p className="text-gray-900 text-lg sm:text-xl md:text-2xl font-bold">{stats.vtuTransactions.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-200">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Voucher Transactions</p>
              <p className="text-gray-900 text-lg sm:text-xl md:text-2xl font-bold">{stats.voucherTransactions.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 sm:p-4 border border-amber-200">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Agent Orders</p>
              <p className="text-gray-900 text-lg sm:text-xl md:text-2xl font-bold">{stats.agentOrders.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm">
            Showing page {pagination.page} of {pagination.totalPages} (Limit: {pagination.limit} per page)
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 border border-gray-200 shadow-lg mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by ID, user, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm"
            >
              <option value="ALL">All Network</option>
              <option value="MTN">MTN</option>
              <option value="Vodafone">Vodafone</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm"
            >
              <option value="ALL">All Source</option>
              <option value="API">API</option>
              <option value="MANUAL">Manual</option>
            </select>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
              <Calendar className="h-4 w-4 text-gray-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as DateRange)}
                className="border-0 p-0 text-sm text-gray-900 focus:outline-none focus:ring-0 bg-transparent"
              >
                <option value="ALL">All time</option>
                <option value="TODAY">Today</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>
            {dateRangeFilter === 'CUSTOM' && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    placeholder="Start Date"
                    className="w-[140px] sm:w-[160px] border-0 p-0 text-sm text-gray-900 focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
                  <span className="text-gray-500 text-sm">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    placeholder="End Date"
                    className="w-[140px] sm:w-[160px] border-0 p-0 text-sm text-gray-900 focus-visible:ring-0"
                  />
                </div>
              </>
            )}
            <Button
              onClick={fetchData}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
              Apply Filters
            </Button>
            <Button
              onClick={clearFilters}
              variant="outline"
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            Active Filters:{' '}
            {statusFilter !== 'ALL' && <span className="ml-2">Status: {statusFilter}</span>}
            {networkFilter !== 'ALL' && <span className="ml-2">Network: {networkFilter}</span>}
            {sourceFilter !== 'ALL' && <span className="ml-2">Source: {sourceFilter}</span>}
            {searchQuery && <span className="ml-2">Search: {searchQuery}</span>}
            {dateRangeFilter === 'ALL' && <span className="ml-2">Date: All time</span>}
            {dateRangeFilter === 'TODAY' && <span className="ml-2">Date: Today</span>}
            {dateRangeFilter === 'THIS_WEEK' && <span className="ml-2">Date: This Week</span>}
            {dateRangeFilter === 'THIS_MONTH' && <span className="ml-2">Date: This Month</span>}
            {dateRangeFilter === 'CUSTOM' && customStartDate && customEndDate && (
              <span className="ml-2">
                Date: {new Date(customStartDate).toLocaleDateString()} to {new Date(customEndDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-gray-900 text-sm px-3 py-1">
                  {selectedOrders.size} order(s) selected
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700 font-medium">Update to:</span>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-sm border-blue-300 bg-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkUpdateStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  Update
                </Button>
                <Button
                  onClick={() => {
                    setSelectedOrders(new Set())
                    setBulkStatus('')
                  }}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white backdrop-blur-md rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <h2 className="text-gray-900 text-base sm:text-lg md:text-xl font-semibold">Transactions ({pagination.total})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">API: {todayStats.vtuTransactions}</Badge>
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Manual: {todayStats.totalTransactions - todayStats.vtuTransactions}</Badge>
              <Button
                onClick={handleExportOrders}
                variant="outline"
                size="sm"
                className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs sm:text-sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export Orders</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center w-5 h-5 rounded border border-gray-300 hover:bg-gray-100 cursor-pointer"
                      title={selectedOrders.size === orders.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedOrders.size === orders.length && orders.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ORDER NUMBER</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NETWORK</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PHONE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DATA SIZE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SOURCE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order, idx) => (
                    <tr key={order.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <button
                          onClick={() => toggleOrderSelection(order.id)}
                          className="flex items-center justify-center w-5 h-5 rounded border border-gray-300 hover:bg-gray-100 cursor-pointer"
                          title={selectedOrders.has(order.id) ? 'Deselect' : 'Select'}
                        >
                          {selectedOrders.has(order.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900 font-medium">
                        {order.orderNumber ? String(order.orderNumber).padStart(3, '0') : '---'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">{formatNetworkName(order.network)}</Badge>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900">{order.phone}</td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900">{formatDataAmount(order.dataAmount)}</td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        {order.isManual ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Manual</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">API</Badge>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        {order.status === 'COMPLETED' && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Completed</Badge>}
                        {order.status === 'PROCESSING' && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Processing</Badge>}
                        {order.status === 'PENDING' && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Pending</Badge>}
                        {order.status === 'FAILED' && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Failed</Badge>}
                        {order.status === 'CANCELLED' && <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs">Cancelled</Badge>}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setSelectedOrderForDetails(order)
                              setDetailsDialogOpen(true)
                            }}
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                            title="View Order Details"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleUpdateStatus(order.id, value)}
                          >
                            <SelectTrigger className="w-[120px] sm:w-[140px] h-8 text-xs border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="PROCESSING">Processing</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                              <SelectItem value="FAILED">Failed</SelectItem>
                              <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => {
                              setSelectedOrderForLogs({ id: order.id, reference: order.reference })
                              setLogsDialogOpen(true)
                            }}
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            title="View Order Logs"
                          >
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Order Details Dialog */}
      <OrderDetailsDialog
        order={selectedOrderForDetails}
        isOpen={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false)
          setSelectedOrderForDetails(null)
        }}
      />

      {/* Order Logs Dialog */}
      {selectedOrderForLogs && (
        <OrderLogsDialog
          orderId={selectedOrderForLogs.id}
          orderReference={selectedOrderForLogs.reference}
          isOpen={logsDialogOpen}
          onClose={() => {
            setLogsDialogOpen(false)
            setSelectedOrderForLogs(null)
          }}
        />
      )}
    </AdminLayout>
  )
}
