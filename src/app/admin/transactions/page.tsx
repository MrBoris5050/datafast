'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  Hourglass,
  RefreshCw,
  CheckCircle,
  X,
  DollarSign,
  BarChart3,
  Trash2,
} from 'lucide-react'

interface Transaction {
  id: string
  reference: string
  type: string
  amount: number
  status: string
  description: string
  userName: string
  userEmail: string
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

export default function AdminTransactionsPage() {
  const { data: session } = useSession()
  const [transactions, setTransactions] = useState<Transaction[]>([])
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
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 })

  useEffect(() => {
    fetchData()
  }, [page, statusFilter, typeFilter, searchQuery])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(typeFilter !== 'ALL' && { type: typeFilter }),
        ...(searchQuery && { search: searchQuery }),
      })
      
      const [txRes, statsRes] = await Promise.all([
        fetch(`/api/admin/transactions/list?${params}`, { cache: 'no-store' }),
        fetch('/api/admin/transactions/stats', { cache: 'no-store' }),
      ])
      
      const txData = await txRes.json()
      const statsData = await statsRes.json()
      
      if (txRes.ok && txData.data) {
        setTransactions(txData.data)
        if (txData.pagination) setPagination(txData.pagination)
      }
      
      if (statsRes.ok && statsData.data) {
        setStats(statsData.data)
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
    setTypeFilter('ALL')
    setPage(1)
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-3 sm:p-4 lg:p-6">
        {/* Transaction Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="bg-orange-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-orange-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Pending</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.pending}</p>
              </div>
              <Hourglass className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-orange-600" />
            </div>
          </div>
          
          <div className="bg-purple-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Processing</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.processing}</p>
              </div>
              <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-green-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-green-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Successful</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.successful}</p>
              </div>
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-pink-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-pink-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Canceled</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.canceled}</p>
              </div>
              <X className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-pink-600" />
            </div>
          </div>
          
          <div className="bg-blue-50 backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm mb-1">Refunded</p>
                <p className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{stats.refunded}</p>
              </div>
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <h2 className="text-gray-900 text-base sm:text-lg md:text-xl font-semibold">Transaction Summary</h2>
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
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="PURCHASE">Purchase</option>
              <option value="TOPUP">Top-up</option>
              <option value="REFUND">Refund</option>
              <option value="COMMISSION">Commission</option>
              <option value="BONUS">Bonus</option>
            </select>
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
            {typeFilter !== 'ALL' && <span className="ml-2">Type: {typeFilter}</span>}
            {searchQuery && <span className="ml-2">Search: {searchQuery}</span>}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white backdrop-blur-md rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-gray-900 text-base sm:text-lg md:text-xl font-semibold">Transactions ({pagination.total})</h2>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">USER</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">REFERENCE</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DESCRIPTION</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">AMOUNT</th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      Loading transactions...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <div className="text-xs sm:text-sm text-gray-900 font-medium">{tx.userName}</div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">{tx.userEmail}</div>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{tx.type}</Badge>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs truncate max-w-[100px] sm:max-w-none">{tx.reference}</Badge>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900 truncate max-w-[150px] sm:max-w-none">{tx.description}</td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-900 font-semibold text-right">₵{tx.amount.toFixed(2)}</td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4">
                        {tx.status === 'COMPLETED' && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Completed</Badge>}
                        {tx.status === 'PENDING' && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Pending</Badge>}
                        {tx.status === 'FAILED' && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Failed</Badge>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

