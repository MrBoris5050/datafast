'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, Search, BarChart3, Trash2 } from 'lucide-react'
import { formatNetworkName } from '@/lib/utils'

type Order = {
  id: string
  orderNumber?: number | null
  planName: string
  network: string
  dataAmount: number
  amount: number
  status: string
  phone: string
  reference: string
  createdAt: string
}

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [networkFilter, setNetworkFilter] = useState('ALL')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/orders/list', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await res.json().catch(() => null)
        if (mounted && res.ok && Array.isArray(data?.data)) setOrders(data.data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [session?.user?.id, status])

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.orderNumber && String(order.orderNumber).includes(searchQuery)) ||
      order.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.phone.includes(searchQuery)
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter
    const matchesNetwork = networkFilter === 'ALL' || order.network === networkFilter
    return matchesSearch && matchesStatus && matchesNetwork
  })

  const stats = {
    total: filteredOrders.length,
    completed: filteredOrders.filter(o => o.status === 'COMPLETED').length,
    processing: filteredOrders.filter(o => o.status === 'PROCESSING').length,
    pending: filteredOrders.filter(o => o.status === 'PENDING').length,
    failed: filteredOrders.filter(o => o.status === 'FAILED').length,
  }

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase()
    switch (s) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-50 text-emerald-600 border-0">Completed</Badge>
      case 'PROCESSING':
        return <Badge className="bg-purple-50 text-purple-600 border-0">Processing</Badge>
      case 'PENDING':
        return <Badge className="bg-orange-50 text-orange-600 border-0">Pending</Badge>
      case 'FAILED':
        return <Badge className="bg-red-50 text-red-600 border-0">Failed</Badge>
      case 'CANCELLED':
        return <Badge className="bg-pink-50 text-pink-600 border-0">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-500 border-0">{s}</Badge>
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setNetworkFilter('ALL')
  }

  return (
    <DashboardLayout title="Data Orders">
      <div className="min-h-screen p-2 sm:p-4 lg:p-6">
        <div className="flex items-center space-x-2 sm:space-x-4 mb-4 sm:mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs sm:text-sm text-gray-500">Back to Dashboard</span>
        </div>

        {/* Order Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-white border border-orange-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Pending</p>
            <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.pending}</p>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Processing</p>
            <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.processing}</p>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Completed</p>
            <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.completed}</p>
          </div>
          <div className="bg-white border border-pink-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Failed</p>
            <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.failed}</p>
          </div>
          <div className="bg-white border border-blue-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Total</p>
            <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.total}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
              <Input
                placeholder="Search by order number, reference, plan, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 text-sm"
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
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 text-sm"
            >
              <option value="ALL">All Network</option>
              <option value="MTN">MTN</option>
              <option value="Vodafone">Telecel</option>
            </select>
            <Button
              onClick={clearFilters}
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-gray-900 text-base sm:text-lg">Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loading ? (
              <div className="text-gray-500 text-sm sm:text-base py-8 text-center">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-gray-200 p-6 sm:p-8 text-center text-gray-500">
                <p className="text-sm sm:text-base">No orders yet.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredOrders.map((order, idx) => (
                        <tr key={order.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(order.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                            {order.orderNumber ? String(order.orderNumber).padStart(3, '0') : '---'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{order.planName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <Badge className="bg-yellow-50 text-yellow-600 border-0 text-xs">{formatNetworkName(order.network)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {order.dataAmount >= 1024 ? `${(order.dataAmount / 1024).toFixed(1)} GB` : `${order.dataAmount} MB`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">₵{order.amount.toFixed(2)}</td>
                          <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">Order #{order.orderNumber ? String(order.orderNumber).padStart(3, '0') : '---'}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">{order.planName}</h3>
                          <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">₵{order.amount.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Network</p>
                          <Badge className="bg-yellow-50 text-yellow-600 border-0 text-xs">{formatNetworkName(order.network)}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Data</p>
                          <p className="text-xs font-medium text-gray-900">
                            {order.dataAmount >= 1024 ? `${(order.dataAmount / 1024).toFixed(1)} GB` : `${order.dataAmount} MB`}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                          <p className="text-xs font-medium text-gray-900">{order.phone}</p>
                        </div>
                      </div>
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
