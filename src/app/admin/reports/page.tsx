'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  FileText,
  Download,
  Calendar,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ReportData {
  period: string
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  topCustomers: Array<{
    id: string
    name: string
    email: string
    totalSpent: number
    orderCount: number
  }>
  topPlans: Array<{
    id: string
    name: string
    network: string
    orderCount: number
    revenue: number
  }>
}

export default function AdminReportsPage() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [reportType, setReportType] = useState('summary')

  useEffect(() => {
    fetchReports()
  }, [timeRange, reportType])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/reports?range=${timeRange}&type=${reportType}`, { cache: 'no-store' })
      
      if (!response.ok) {
        if (response.status === 401) {
          setReportData(null)
          return
        }
        throw new Error('Failed to fetch reports')
      }
      
      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error('Error fetching reports:', error)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = () => {
    if (!reportData) return
    
    // Generate CSV data
    const csvRows = []
    
    // Summary section
    csvRows.push('Report Summary')
    csvRows.push(`Period: ${reportData.period}`)
    csvRows.push(`Total Users: ${reportData.totalUsers}`)
    csvRows.push(`Total Orders: ${reportData.totalOrders}`)
    csvRows.push(`Total Revenue: ₵${reportData.totalRevenue.toFixed(2)}`)
    csvRows.push(`Average Order Value: ₵${reportData.averageOrderValue.toFixed(2)}`)
    csvRows.push('')
    
    // Top Customers
    csvRows.push('Top Customers')
    csvRows.push('Name,Email,Total Spent,Order Count')
    reportData.topCustomers.forEach(customer => {
      csvRows.push(`${customer.name || 'N/A'},${customer.email},₵${customer.totalSpent.toFixed(2)},${customer.orderCount}`)
    })
    csvRows.push('')
    
    // Top Plans
    csvRows.push('Top Data Plans')
    csvRows.push('Plan Name,Network,Order Count,Revenue')
    reportData.topPlans.forEach(plan => {
      csvRows.push(`${plan.name},${plan.network},${plan.orderCount},₵${plan.revenue.toFixed(2)}`)
    })
    
    // Create and download CSV
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${timeRange}-${new Date().toISOString()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports</h1>
              <p className="text-sm sm:text-base text-gray-400">Generate and export detailed platform reports</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[150px] sm:w-[180px] bg-gray-100 border-gray-200 text-gray-900">
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
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[140px] sm:w-[180px] bg-gray-100 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Report type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-100 border-gray-200">
                  <SelectItem value="summary" className="text-gray-900 hover:bg-gray-100">Summary</SelectItem>
                  <SelectItem value="detailed" className="text-gray-900 hover:bg-gray-100">Detailed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchReports} disabled={loading} className="border-gray-200 text-gray-300 hover:bg-gray-100">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <Button onClick={handleExportReport} disabled={!reportData} className="bg-blue-600 hover:bg-blue-700 shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading reports...</p>
              </div>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Card className="bg-gray-100 border-gray-200 hover:bg-gray-100 transition">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-900">Total Users</CardTitle>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{reportData.totalUsers.toLocaleString()}</div>
                    <p className="text-xs text-gray-400 mt-1">Period: {reportData.period}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-100 border-gray-200 hover:bg-gray-100 transition">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-900">Total Orders</CardTitle>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <ShoppingCart className="h-4 w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{reportData.totalOrders.toLocaleString()}</div>
                    <p className="text-xs text-gray-400 mt-1">Period: {reportData.period}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-100 border-gray-200 hover:bg-gray-100 transition">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-900">Total Revenue</CardTitle>
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-yellow-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">₵{reportData.totalRevenue.toLocaleString()}</div>
                    <p className="text-xs text-gray-400 mt-1">Period: {reportData.period}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-100 border-gray-200 hover:bg-gray-100 transition">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-900">Avg Order Value</CardTitle>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">₵{reportData.averageOrderValue.toFixed(2)}</div>
                    <p className="text-xs text-gray-400 mt-1">Period: {reportData.period}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Customers */}
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Top Customers</CardTitle>
                  <CardDescription className="text-gray-400">
                    Customers with highest spending
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.topCustomers.length > 0 ? (
                      reportData.topCustomers.map((customer, index) => (
                        <div key={customer.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-300">#{index + 1}</span>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{customer.name || 'N/A'}</h3>
                              <p className="text-sm text-gray-400">{customer.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">₵{customer.totalSpent.toFixed(2)}</div>
                            <div className="text-sm text-gray-400">{customer.orderCount} orders</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">No customer data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Plans */}
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Top Data Plans</CardTitle>
                  <CardDescription className="text-gray-400">
                    Most popular data plans by revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.topPlans.length > 0 ? (
                      reportData.topPlans.map((plan, index) => (
                        <div key={plan.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-300">#{index + 1}</span>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{plan.name}</h3>
                              <p className="text-sm text-gray-400">{plan.network}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">₵{plan.revenue.toFixed(2)}</div>
                            <div className="text-sm text-gray-400">{plan.orderCount} orders</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">No plan data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No report data available</h3>
              <p className="text-gray-400">Report data will appear here once available.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
