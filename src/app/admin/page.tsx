"use client"

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { 
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ PENDING: 0, PROCESSING: 0, COMPLETED: 0, REFUNDED: 0, CANCELLED: 0 })
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/summary', { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) {
          setCounts({
            PENDING: data.data.orders.PENDING || 0,
            PROCESSING: data.data.orders.PROCESSING || 0,
            COMPLETED: data.data.orders.COMPLETED || 0,
            REFUNDED: 0,
            CANCELLED: data.data.orders.CANCELLED || 0,
          })
          setRecent(data.data.recent)
        }
      } catch {}
    }
    load()
  }, [])

  return (
    <AdminLayout>
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex items-center gap-3 mb-2">
            {/* <div className="p-2 bg-white rounded-lg shadow-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="datafast Logo" 
                width={24} 
                height={24} 
                className="w-full h-full object-contain"
                unoptimized
              />
            </div> */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-gray-900 text-sm sm:text-base">Manage users, data plans, and monitor platform performance</p>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          {/* Pending Orders */}
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-yellow-600" />
              </div>
            </div>
            <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Pending Orders</div>
            <div className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{counts.PENDING}</div>
          </div>

          {/* Processing Orders */}
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
            <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Processing Orders</div>
            <div className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{counts.PROCESSING}</div>
          </div>

          {/* Successful Orders */}
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <div className="p-2 sm:p-3 bg-green-100 rounded-xl">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
            <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Successful Orders</div>
            <div className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{counts.COMPLETED}</div>
          </div>

          {/* Refunded Orders */}
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <div className="p-2 sm:p-3 bg-emerald-100 rounded-xl">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Refunded Orders</div>
            <div className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{counts.REFUNDED}</div>
          </div>

          {/* Canceled Orders */}
          <div className="bg-white backdrop-blur-md rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <div className="p-2 sm:p-3 bg-red-100 rounded-xl">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-red-600" />
              </div>
            </div>
            <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Canceled Orders</div>
            <div className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold">{counts.CANCELLED}</div>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-white backdrop-blur-md rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <h2 className="text-gray-900 text-base sm:text-lg md:text-xl font-semibold">Recent Transactions</h2>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    USER
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    NETWORK
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    PHONE
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    AMOUNT
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    STATUS
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    DATE & TIME
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-600 text-sm">
                      No recent transactions
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{r.user}</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">{r.email}</div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">
                          {r.network}
                        </Badge>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                        {r.phone}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                        ₵{r.amount}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                        <div>{new Date(r.date).toLocaleDateString()}</div>
                        <div className="hidden sm:block">{new Date(r.date).toLocaleTimeString()}</div>
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
