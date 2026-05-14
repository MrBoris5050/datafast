'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Users,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserCheck,
  UserX,
  Wallet,
  Calendar,
  RefreshCw,
  Download,
  Crown,
  ShoppingCart,
  DollarSign,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface UserAnalyticsData {
  summary: {
    totalUsers: number
    newUsersInPeriod: number
    previousPeriodUsers: number
    growthPercentage: number
    activeUsers: number
    inactiveUsers: number
    usersWithBalance: number
    totalWalletBalance: number
  }
  roleDistribution: Array<{
    role: string
    count: number
  }>
  topUsersByOrders: Array<{
    id: string
    name: string
    email: string
    role: string
    orderCount: number
  }>
  topUsersBySpending: Array<{
    id: string
    name: string
    email: string
    role: string
    totalSpent: number
    orderCount: number
  }>
  dailyRegistrations: Array<{
    date: string
    count: number
  }>
  monthlyTrend: Array<{
    month: string
    count: number
  }>
  recentRegistrations: Array<{
    id: string
    name: string
    email: string
    role: string
    createdAt: string
    walletBalance: number
    orderCount: number
  }>
  dateRange: {
    start: string
    end: string
  }
}

export default function UserAnalyticsPage() {
  const { data: session } = useSession()
  const [analytics, setAnalytics] = useState<UserAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
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
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate,
        endDate
      })
      
      const response = await fetch(`/api/admin/user-analytics?${params}`, { 
        cache: 'no-store' 
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      
      const data = await response.json()
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Error fetching user analytics:', error)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    fetchAnalytics()
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
        endDate: newEndDate
      })
      
      const response = await fetch(`/api/admin/user-analytics?${params}`, { 
        cache: 'no-store' 
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      
      const data = await response.json()
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Error fetching user analytics:', error)
      setAnalytics(null)
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-500'
      case 'AGENT': return 'bg-orange-500'
      case 'WHOLESALER': return 'bg-purple-500'
      case 'DEALER': return 'bg-green-500'
      case 'CUSTOMER': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportData = () => {
    if (!analytics) return
    
    const csvData = [
      ['User Analytics Report'],
      [`Period: ${formatDate(analytics.dateRange.start)} - ${formatDate(analytics.dateRange.end)}`],
      [],
      ['Summary'],
      ['Total Users', analytics.summary.totalUsers],
      ['New Users in Period', analytics.summary.newUsersInPeriod],
      ['Growth %', analytics.summary.growthPercentage],
      ['Active Users', analytics.summary.activeUsers],
      [],
      ['Role Distribution'],
      ['Role', 'Count'],
      ...analytics.roleDistribution.map(r => [r.role, r.count]),
      [],
      ['Top Users by Orders'],
      ['Name', 'Email', 'Role', 'Orders'],
      ...analytics.topUsersByOrders.map(u => [u.name, u.email, u.role, u.orderCount]),
      [],
      ['Top Users by Spending'],
      ['Name', 'Email', 'Role', 'Total Spent', 'Orders'],
      ...analytics.topUsersBySpending.map(u => [u.name, u.email, u.role, u.totalSpent, u.orderCount])
    ]
    
    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-analytics-${startDate}-to-${endDate}.csv`
    a.click()
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">User Analytics</h1>
          <p className="text-gray-400">Detailed insights into user activity and growth</p>
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
              disabled={!analytics}
              className="border-gray-200 text-gray-300 hover:bg-gray-100 bg-gray-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {analytics && (
              <span className="text-gray-400 text-sm">
                {formatDate(analytics.dateRange.start)} - {formatDate(analytics.dateRange.end)}
              </span>
            )}
          </div>

          {showFilters && (
            <div className="bg-white rounded-xl p-4 animate-fade-in">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
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
              <p className="text-gray-400 mt-2">Loading analytics...</p>
            </div>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{analytics.summary.totalUsers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">New Users (Period)</p>
                    <p className="text-3xl font-bold text-gray-900">{analytics.summary.newUsersInPeriod.toLocaleString()}</p>
                    <div className="flex items-center mt-1">
                      {analytics.summary.growthPercentage >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm ${analytics.summary.growthPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {analytics.summary.growthPercentage >= 0 ? '+' : ''}{analytics.summary.growthPercentage}%
                      </span>
                      <span className="text-gray-500 text-xs ml-1">vs prev period</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <UserPlus className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Active Users</p>
                    <p className="text-3xl font-bold text-gray-900">{analytics.summary.activeUsers.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Users with orders in period</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Wallet Balance</p>
                    <p className="text-3xl font-bold text-gray-900">₵{analytics.summary.totalWalletBalance.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">{analytics.summary.usersWithBalance} users with balance</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Role Distribution & Monthly Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Role Distribution */}
              <div className="bg-white rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-600" />
                    Users by Role
                  </h3>
                  <p className="text-gray-400 text-sm">Distribution of new users in selected period</p>
                </div>
                {analytics.roleDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.roleDistribution.map((role) => {
                      const total = analytics.roleDistribution.reduce((sum, r) => sum + r.count, 0)
                      const percentage = total > 0 ? (role.count / total * 100).toFixed(1) : 0
                      return (
                        <div key={role.role} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getRoleBadge(role.role)}
                            </div>
                            <span className="text-gray-900 font-semibold">{role.count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${getRoleColor(role.role)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No new users in this period</p>
                )}
              </div>

              {/* Monthly Trend */}
              <div className="bg-white rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Monthly Registration Trend
                  </h3>
                  <p className="text-gray-400 text-sm">User registrations over the last 6 months</p>
                </div>
                {analytics.monthlyTrend.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.monthlyTrend.map((month) => {
                      const maxCount = Math.max(...analytics.monthlyTrend.map(m => m.count))
                      const percentage = maxCount > 0 ? (month.count / maxCount * 100) : 0
                      return (
                        <div key={month.month} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">{month.month}</span>
                            <span className="text-gray-900 font-semibold">{month.count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
              </div>
            </div>

            {/* Top Users Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Users by Orders */}
              <div className="bg-white rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-green-600" />
                    Top Users by Orders
                  </h3>
                  <p className="text-gray-400 text-sm">Users with most orders in selected period</p>
                </div>
                {analytics.topUsersByOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">#</th>
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">User</th>
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">Role</th>
                          <th className="text-right text-xs font-semibold text-gray-400 py-2">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topUsersByOrders.map((user, idx) => (
                          <tr key={user.id} className="border-b border-gray-200">
                            <td className="py-2 text-gray-500 text-sm">{idx + 1}</td>
                            <td className="py-2">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[150px]">{user.email}</div>
                            </td>
                            <td className="py-2">{getRoleBadge(user.role)}</td>
                            <td className="py-2 text-right font-semibold text-gray-900">{user.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No orders in this period</p>
                )}
              </div>

              {/* Top Users by Spending */}
              <div className="bg-white rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                    Top Users by Spending
                  </h3>
                  <p className="text-gray-400 text-sm">Highest spending users in selected period</p>
                </div>
                {analytics.topUsersBySpending.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">#</th>
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">User</th>
                          <th className="text-left text-xs font-semibold text-gray-400 py-2">Role</th>
                          <th className="text-right text-xs font-semibold text-gray-400 py-2">Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topUsersBySpending.map((user, idx) => (
                          <tr key={user.id} className="border-b border-gray-200">
                            <td className="py-2 text-gray-500 text-sm">{idx + 1}</td>
                            <td className="py-2">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[150px]">{user.email}</div>
                            </td>
                            <td className="py-2">{getRoleBadge(user.role)}</td>
                            <td className="py-2 text-right font-semibold text-yellow-600">₵{user.totalSpent.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No spending in this period</p>
                )}
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-white rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Recent Registrations
                </h3>
                <p className="text-gray-400 text-sm">Latest user registrations in selected period</p>
              </div>
              {analytics.recentRegistrations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">User</th>
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">Role</th>
                        <th className="text-left text-xs font-semibold text-gray-400 py-3 px-2">Joined</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Balance</th>
                        <th className="text-right text-xs font-semibold text-gray-400 py-3 px-2">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentRegistrations.map((user, idx) => (
                        <tr key={user.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-gray-50'}>
                          <td className="py-3 px-2">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{user.email}</div>
                          </td>
                          <td className="py-3 px-2">{getRoleBadge(user.role)}</td>
                          <td className="py-3 px-2 text-sm text-gray-400">{formatDateTime(user.createdAt)}</td>
                          <td className="py-3 px-2 text-right text-sm font-medium text-gray-900">₵{user.walletBalance.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right text-sm text-gray-900">{user.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No registrations in this period</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data available</h3>
            <p className="text-gray-400">Try adjusting your date filters or check back later.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
