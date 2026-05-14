'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Wifi,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNetworkName } from '@/lib/utils'

interface AnalyticsData {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  activeDataPlans: number
  newUsersToday: number
  ordersToday: number
  revenueToday: number
  userGrowth: number
  orderGrowth: number
  revenueGrowth: number
  topNetworks: Array<{
    network: string
    orders: number
    revenue: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
}

export default function AdminAnalyticsPage() {
  const { data: session } = useSession()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/analytics?range=${timeRange}`, { cache: 'no-store' })
      
      if (!response.ok) {
        if (response.status === 401) {
          setAnalytics(null)
          return
        }
        throw new Error('Failed to fetch analytics')
      }
      
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )
  }

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getNetworkBadge = (network: string) => {
    const displayName = formatNetworkName(network)
    switch (network) {
      case 'MTN':
        return <Badge className="bg-yellow-100 text-yellow-800">{displayName}</Badge>
      case 'Vodafone':
        return <Badge className="bg-red-100 text-red-800">{displayName}</Badge>
      case 'AirtelTigo':
        return <Badge className="bg-green-100 text-green-800">{displayName}</Badge>
      case 'AT BIGTIME':
        return <Badge className="bg-green-100 text-green-800">{displayName}</Badge>
      case 'AT ISHARE':
        return <Badge className="bg-green-100 text-green-800">{displayName}</Badge>
      case 'TELECEL':
        return <Badge className="bg-red-100 text-red-800">{displayName}</Badge>
      default:
        return <Badge variant="outline">{displayName}</Badge>
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-4 w-4 text-blue-500" />
      case 'user':
        return <Users className="h-4 w-4 text-green-500" />
      case 'plan':
        return <Wifi className="h-4 w-4 text-purple-500" />
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />
    }
  }

  const handleExportData = () => {
    // In a real app, this would generate and download a report
    console.log('Exporting analytics data...')
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-400">Platform performance metrics and insights</p>
        </div>
        <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px] bg-gray-100 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent className="bg-gray-100 border-gray-200">
                  <SelectItem value="1d" className="text-gray-900 hover:bg-gray-100">Last 24 hours</SelectItem>
                  <SelectItem value="7d" className="text-gray-900 hover:bg-gray-100">Last 7 days</SelectItem>
                  <SelectItem value="30d" className="text-gray-900 hover:bg-gray-100">Last 30 days</SelectItem>
                  <SelectItem value="90d" className="text-gray-900 hover:bg-gray-100">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchAnalytics} disabled={loading} className="border-gray-200 text-gray-300 hover:bg-gray-100">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <Button onClick={handleExportData} className="bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading analytics...</p>
            </div>
          </div>
        ) : analytics ? (
          <div>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalUsers.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs">
                    {getGrowthIcon(analytics.userGrowth)}
                    <span className={getGrowthColor(analytics.userGrowth)}>
                      +{analytics.userGrowth}%
                    </span>
                    <span className="text-gray-500">from last period</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">+{analytics.newUsersToday} today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalOrders.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs">
                    {getGrowthIcon(analytics.orderGrowth)}
                    <span className={getGrowthColor(analytics.orderGrowth)}>
                      +{analytics.orderGrowth}%
                    </span>
                    <span className="text-gray-500">from last period</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">+{analytics.ordersToday} today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₵{analytics.totalRevenue.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs">
                    {getGrowthIcon(analytics.revenueGrowth)}
                    <span className={getGrowthColor(analytics.revenueGrowth)}>
                      +{analytics.revenueGrowth}%
                    </span>
                    <span className="text-gray-500">from last period</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">+₵{analytics.revenueToday.toLocaleString()} today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Data Plans</CardTitle>
                  <Wifi className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.activeDataPlans}</div>
                  <p className="text-xs text-gray-500">Active plans</p>
                </CardContent>
              </Card>
            </div>

            {/* Network Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Network Performance</CardTitle>
                <CardDescription>
                  Orders and revenue by network provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topNetworks.map((network, index) => (
                    <div key={network.network} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-300">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{network.network}</h3>
                            {getNetworkBadge(network.network)}
                          </div>
                          <p className="text-sm text-gray-400">{network.orders} orders</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">₵{network.revenue.toLocaleString()}</div>
                        <div className="text-sm text-gray-400">
                          {((network.revenue / analytics.totalRevenue) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest platform activities and events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex-shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data available</h3>
            <p className="text-gray-400">Analytics data will appear here once available.</p>
          </div>
        )}
      </div>
      </div>
    </AdminLayout>
  )
}
