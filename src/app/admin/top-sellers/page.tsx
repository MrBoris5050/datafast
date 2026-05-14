'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Trophy,
  TrendingUp,
  Users,
  DollarSign,
  ShoppingCart,
  Calendar,
  RefreshCw,
  Download,
  Medal,
  Crown,
  Award,
  Wallet,
  Target,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { formatNetworkName } from '@/lib/utils'

interface Seller {
  rank: number
  userId: string
  name: string
  email: string
  phone: string
  role: string
  walletBalance: number
  memberSince: string
  totalSales: number
  orderCount: number
  completedOrders: number
  failedOrders: number
  averageOrderValue: number
  successRate: string
}

interface TopSellersData {
  sellers: Seller[]
  summary: {
    totalSalesInPeriod: number
    totalOrdersInPeriod: number
    uniqueSellers: number
    averagePerSeller: number
  }
  networkBreakdown: Array<{
    network: string
    sales: number
    orders: number
  }>
  dateRange: {
    start: string
    end: string
  }
}

export default function TopSellersPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<TopSellersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [showFilters, setShowFilters] = useState(false)
  
  // Date filter state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate,
        endDate,
        role: roleFilter,
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/top-sellers?${params}`, { 
        cache: 'no-store' 
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching top sellers:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    fetchData()
  }

  const setQuickRange = async (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    const newStartDate = start.toISOString().split('T')[0]
    const newEndDate = end.toISOString().split('T')[0]
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    
    // Fetch data with new dates immediately
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: newStartDate,
        endDate: newEndDate,
        role: roleFilter,
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/top-sellers?${params}`, { 
        cache: 'no-store' 
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching top sellers:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-red-50 text-red-600 border-red-200">Admin</Badge>
      case 'AGENT':
        return <Badge className="bg-orange-50 text-orange-600 border-orange-200">Agent</Badge>
      case 'WHOLESALER':
        return <Badge className="bg-purple-50 text-purple-600 border-purple-200">Wholesaler</Badge>
      case 'DEALER':
        return <Badge className="bg-green-50 text-green-600 border-green-200">Dealer</Badge>
      case 'CUSTOMER':
      default:
        return <Badge className="bg-blue-50 text-blue-600 border-blue-200">Customer</Badge>
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-600" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-300" />
      case 3:
        return <Award className="h-6 w-6 text-orange-600" />
      default:
        return <span className="text-gray-400 font-bold text-lg">#{rank}</span>
    }
  }

  const getRankBackground = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200'
      case 2:
        return 'bg-gray-50 border-gray-200'
      case 3:
        return 'bg-orange-50 border-orange-200'
      default:
        return 'bg-gray-100 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const exportData = () => {
    if (!data) return
    
    const csvData = [
      ['Top Sellers Report'],
      [`Period: ${formatDate(data.dateRange.start)} - ${formatDate(data.dateRange.end)}`],
      [],
      ['Rank', 'Name', 'Email', 'Phone', 'Role', 'Total Sales (₵)', 'Orders', 'Avg Order Value (₵)', 'Success Rate (%)'],
      ...data.sellers.map(s => [
        s.rank,
        s.name,
        s.email,
        s.phone,
        s.role,
        s.totalSales.toFixed(2),
        s.orderCount,
        s.averageOrderValue.toFixed(2),
        s.successRate
      ])
    ]
    
    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `top-sellers-${startDate}-to-${endDate}.csv`
    a.click()
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-600" />
            Top Sellers
          </h1>
          <p className="text-gray-400">Users with the highest sales in the selected period</p>
        </div>

        {/* Filter Button & Collapsible Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={exportData}
              disabled={!data}
              className="border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {data && (
              <span className="text-gray-400 text-sm">
                {formatDate(data.dateRange.start)} - {formatDate(data.dateRange.end)}
              </span>
            )}
          </div>

          {showFilters && (
            <div className="bg-white rounded-xl p-4 animate-fade-in">
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-end">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-gray-100 border-gray-200 text-gray-900"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-gray-100 border-gray-200 text-gray-900"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="CUSTOMER">Customer</option>
                      <option value="AGENT">Agent</option>
                      <option value="WHOLESALER">Wholesaler</option>
                      <option value="DEALER">Dealer</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickRange(7)}
                    className="text-xs border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
                  >
                    7 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickRange(30)}
                    className="text-xs border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
                  >
                    30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickRange(90)}
                    className="text-xs border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
                  >
                    90 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickRange(365)}
                    className="text-xs border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
                  >
                    1 Year
                  </Button>
                </div>

                <Button
                  onClick={handleFilter}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Apply Filter
                </Button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading top sellers...</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Sales</p>
                    <p className="text-3xl font-bold text-gray-900">₵{data.summary.totalSalesInPeriod.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Orders</p>
                    <p className="text-3xl font-bold text-gray-900">{data.summary.totalOrdersInPeriod.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Active Sellers</p>
                    <p className="text-3xl font-bold text-gray-900">{data.summary.uniqueSellers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Avg per Seller</p>
                    <p className="text-3xl font-bold text-gray-900">₵{data.summary.averagePerSeller.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                    <Target className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Network Breakdown */}
            {/* {data.networkBreakdown.length > 0 && (
              <div className="bg-white rounded-xl p-6">
                <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Sales by Network
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {data.networkBreakdown.map((network) => (
                    <div key={network.network} className="bg-gray-100 rounded-lg p-4 text-center">
                      <p className="text-gray-400 text-xs mb-1">{formatNetworkName(network.network)}</p>
                      <p className="text-gray-900 font-bold text-lg">₵{network.sales.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{network.orders} orders</p>
                    </div>
                  ))}
                </div>
              </div>
            )} */}

            {/* Top 3 Podium */}
            {data.sellers.length >= 3 && (
              <div className="bg-white rounded-xl p-6">
                <h3 className="text-gray-900 font-semibold mb-6 text-center flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Top 3 Sellers
                </h3>
                <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6">
                  {/* 2nd Place */}
                  <div className="order-2 md:order-1 w-full md:w-48">
                    <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-center">
                      <Medal className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-900 font-bold truncate">{data.sellers[1]?.name || 'N/A'}</p>
                      <p className="text-gray-400 text-xs truncate mb-2">{data.sellers[1]?.email || ''}</p>
                      {getRoleBadge(data.sellers[1]?.role || 'CUSTOMER')}
                      <p className="text-2xl font-bold text-gray-900 mt-3">₵{(data.sellers[1]?.totalSales || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{data.sellers[1]?.orderCount || 0} orders</p>
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="order-1 md:order-2 w-full md:w-56">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center transform md:scale-110">
                      <Crown className="h-10 w-10 text-yellow-600 mx-auto mb-2" />
                      <p className="text-gray-900 font-bold text-lg truncate">{data.sellers[0]?.name || 'N/A'}</p>
                      <p className="text-gray-400 text-xs truncate mb-2">{data.sellers[0]?.email || ''}</p>
                      {getRoleBadge(data.sellers[0]?.role || 'CUSTOMER')}
                      <p className="text-3xl font-bold text-yellow-600 mt-3">₵{(data.sellers[0]?.totalSales || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{data.sellers[0]?.orderCount || 0} orders</p>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="order-3 w-full md:w-48">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                      <Award className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                      <p className="text-gray-900 font-bold truncate">{data.sellers[2]?.name || 'N/A'}</p>
                      <p className="text-gray-400 text-xs truncate mb-2">{data.sellers[2]?.email || ''}</p>
                      {getRoleBadge(data.sellers[2]?.role || 'CUSTOMER')}
                      <p className="text-2xl font-bold text-gray-900 mt-3">₵{(data.sellers[2]?.totalSales || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{data.sellers[2]?.orderCount || 0} orders</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Leaderboard */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Full Leaderboard
              </h3>
              {data.sellers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">Rank</th>
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">User</th>
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">Role</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Total Sales</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Orders</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Avg Order</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Success Rate</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sellers.map((seller) => (
                        <tr 
                          key={seller.userId} 
                          className={`border-b ${getRankBackground(seller.rank)} transition-colors`}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center w-8">
                              {getRankIcon(seller.rank)}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="text-sm font-medium text-gray-900">{seller.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{seller.email}</div>
                            {seller.phone && (
                              <div className="text-xs text-gray-600">{seller.phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-2">{getRoleBadge(seller.role)}</td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-green-600 font-bold">₵{seller.totalSales.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-2 text-right text-gray-900">{seller.orderCount}</td>
                          <td className="py-3 px-2 text-right text-gray-300">₵{seller.averageOrderValue.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {Number(seller.successRate) >= 90 ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : Number(seller.successRate) < 70 ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : null}
                              <span className={`${
                                Number(seller.successRate) >= 90 ? 'text-green-600' : 
                                Number(seller.successRate) < 70 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {seller.successRate}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right text-gray-300">₵{seller.walletBalance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No sales data found for this period</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
            <p className="text-gray-400">Try adjusting your date filters or check back later.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
