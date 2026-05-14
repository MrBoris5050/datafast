'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  User,
  Phone,
  Database,
  Hash,
  Calendar,
  DollarSign,
  Tag,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatNetworkName } from '@/lib/utils'

interface OrderLog {
  id: string
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  message: string
  metadata: any
  createdAt: string
}

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

interface OrderDetailsDialogProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
}

export function OrderDetailsDialog({ order, isOpen, onClose }: OrderDetailsDialogProps) {
  const [logs, setLogs] = useState<OrderLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'logs'>('details')

  useEffect(() => {
    if (isOpen && order) {
      fetchLogs()
      setActiveTab('details')
    }
  }, [isOpen, order?.id])

  const fetchLogs = async () => {
    if (!order) return
    setLogsLoading(true)
    setLogsError(null)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/logs`)
      const data = await res.json()
      if (res.ok && data.success) {
        setLogs(data.data || [])
      } else {
        setLogsError(data.error || 'Failed to fetch logs')
      }
    } catch (err: any) {
      setLogsError(err.message || 'Failed to fetch logs')
    } finally {
      setLogsLoading(false)
    }
  }

  const formatDataAmount = (mb: number) => {
    if (mb >= 1024) {
      const gb = mb / 1024
      return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`
    }
    return `${mb} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>
      case 'PROCESSING':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Processing</Badge>
      case 'PENDING':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pending</Badge>
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>
      case 'CANCELLED':
        return <Badge className="bg-pink-100 text-pink-700 border-pink-200">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{status}</Badge>
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      default:
        return <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'bg-green-50 border-green-200 text-green-900'
      case 'ERROR':
        return 'bg-red-50 border-red-200 text-red-900'
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900'
    }
  }

  if (!isOpen || !order) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Order{' '}
              {order.orderNumber ? (
                <span className="text-purple-600">#{String(order.orderNumber).padStart(3, '0')}</span>
              ) : (
                <span className="text-gray-500 text-sm">{order.orderId}</span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Ref: {order.reference}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(order.status)}
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0 ml-1">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Details
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Logs
            {logs.length > 0 && (
              <span className="ml-1 bg-purple-100 text-purple-700 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
            <div className="p-5 space-y-5">
              {/* Order Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Hash className="h-3.5 w-3.5" />
                    Order Number
                  </div>
                  <p className="text-gray-900 font-semibold">
                    {order.orderNumber ? `#${String(order.orderNumber).padStart(3, '0')}` : '—'}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Date &amp; Time
                  </div>
                  <p className="text-gray-900 font-medium text-sm">{formatDate(order.createdAt)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Tag className="h-3.5 w-3.5" />
                    Network
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                    {formatNetworkName(order.network)}
                  </Badge>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Phone className="h-3.5 w-3.5" />
                    Phone Number
                  </div>
                  <p className="text-gray-900 font-semibold">{order.phone}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Database className="h-3.5 w-3.5" />
                    Data Size
                  </div>
                  <p className="text-gray-900 font-semibold">{formatDataAmount(order.dataAmount)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Amount
                  </div>
                  <p className="text-gray-900 font-semibold">₵{order.amount.toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Info className="h-3.5 w-3.5" />
                    Source
                  </div>
                  {order.isManual ? (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200">Manual</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">API</Badge>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Activity className="h-3.5 w-3.5" />
                    Status
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </div>

              {/* Plan Name */}
              {order.planName && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Database className="h-3.5 w-3.5" />
                    Plan
                  </div>
                  <p className="text-gray-900 font-medium">{order.planName}</p>
                </div>
              )}

              {/* User Info */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700 text-xs font-semibold mb-3 uppercase tracking-wide">
                  <User className="h-3.5 w-3.5" />
                  User Information
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Name</p>
                    <p className="text-gray-900 font-medium text-sm">{order.userName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Email</p>
                    <p className="text-gray-900 text-sm truncate">{order.userEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">User ID</p>
                    <p className="text-gray-600 text-xs font-mono truncate">{order.userId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Order ID</p>
                    <p className="text-gray-600 text-xs font-mono truncate">{order.orderId}</p>
                  </div>
                </div>
              </div>

              {/* Reference */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Payment Reference</p>
                <p className="text-gray-700 text-sm font-mono break-all">{order.reference}</p>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{logs.length} log{logs.length !== 1 ? 's' : ''} found</p>
                <Button
                  onClick={fetchLogs}
                  variant="outline"
                  size="sm"
                  disabled={logsLoading}
                  className="text-xs h-7"
                >
                  {logsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Refresh
                </Button>
              </div>

              {logsLoading && logs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading logs...</span>
                </div>
              ) : logsError ? (
                <div className="flex items-center justify-center py-12">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <span className="ml-2 text-red-500">{logsError}</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Activity className="h-10 w-10 mb-2" />
                  <p className="text-sm">No logs found for this order</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-3 ${getLevelColor(log.level)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-semibold uppercase">{log.level}</span>
                            <span className="text-xs opacity-75 whitespace-nowrap">{formatDate(log.createdAt)}</span>
                          </div>
                          <p className="text-sm font-medium">{log.message}</p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                                View Metadata
                              </summary>
                              <pre className="mt-2 text-xs bg-white bg-opacity-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-end">
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
