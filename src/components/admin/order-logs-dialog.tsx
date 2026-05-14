'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OrderLog {
  id: string
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  message: string
  metadata: any
  createdAt: string
}

interface OrderLogsDialogProps {
  orderId: string
  orderReference: string
  isOpen: boolean
  onClose: () => void
}

export function OrderLogsDialog({ orderId, orderReference, isOpen, onClose }: OrderLogsDialogProps) {
  const [logs, setLogs] = useState<OrderLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && orderId) {
      fetchLogs()
    }
  }, [isOpen, orderId])

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/logs`)
      const data = await res.json()
      if (res.ok && data.success) {
        setLogs(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch logs')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Order Logs</h2>
            <p className="text-sm text-gray-500">Reference: {orderReference}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchLogs}
              variant="outline"
              size="sm"
              disabled={loading}
              className="text-xs"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                'Refresh'
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading logs...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <span className="ml-2 text-red-500">{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Info className="h-6 w-6 text-gray-400" />
              <span className="ml-2 text-gray-500">No logs found for this order</span>
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
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold uppercase">{log.level}</span>
                        <span className="text-xs opacity-75">{formatDate(log.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium">{log.message}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                            View Details
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {logs.length} log{logs.length !== 1 ? 's' : ''} found
          </span>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

