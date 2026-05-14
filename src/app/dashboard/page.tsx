"use client"

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useNetworks } from '@/hooks/use-networks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Wifi, 
  ShoppingCart, 
  CreditCard, 
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
  Wallet,
  ArrowUpRight,
  Zap,
  Plus,
  Eye,
  History,
  Activity,
  ChevronRight,
  Signal
} from 'lucide-react'
import Link from 'next/link'
import { formatNetworkName } from '@/lib/utils'

export default function CustomerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [networks, setNetworks] = useState<Array<{ id: string; name: string }>>([])
  const [stats, setStats] = useState({ totalOrders: 0, totalSpent: 0, activeDataPlans: 0, thisMonthOrders: 0, walletBalance: 0 })
  const [recentOrders, setRecentOrders] = useState<Array<{ 
    id: string; 
    plan: string; 
    amount: number; 
    status: string; 
    date: string;
    reference: string;
    orderNumber: number | null;
    network: string;
    phone: string;
    dataAmount: number;
  }>>([])

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    let mounted = true
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/dashboard/summary', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await res.json()
        if (mounted && res.ok) {
          setStats({
            totalOrders: data.data.totalOrders,
            totalSpent: data.data.totalSpent,
            activeDataPlans: data.data.activeDataPlans,
            thisMonthOrders: data.data.thisMonthOrders,
            walletBalance: data.data.walletBalance,
          })
          setRecentOrders(data.data.recentOrders)
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchSummary()
    return () => { mounted = false }
  }, [session?.user?.id, status])

  const { networks: cachedNetworks } = useNetworks()
  useEffect(() => {
    if (cachedNetworks.length > 0) setNetworks(cachedNetworks)
  }, [cachedNetworks])

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Morning'
    if (hour >= 12 && hour < 17) return 'Afternoon'
    if (hour >= 17 && hour < 22) return 'Evening'
    return 'Night'
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'User'

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Completed' }
      case 'processing': return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Processing' }
      case 'failed': return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Failed' }
      default: return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200', label: 'Unknown' }
    }
  }

  return (
    <DashboardLayout title="" showSearch={false}>
      <div className="space-y-8">

        {/* ── HERO ROW ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Balance hero */}
          <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50" style={{ minHeight: 200 }}>
            {/* Background accent */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

            <div className="relative z-10 p-6 sm:p-8 flex flex-col h-full">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 mb-1">Good {getTimeBasedGreeting()}</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{firstName}</h2>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Active</span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-medium">Wallet Balance</p>
                {loading ? (
                  <div className="h-12 w-44 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
                      ₵{stats.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-auto flex items-center gap-3">
                <Link href="/dashboard/wallet">
                  <button className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]">
                    <Plus className="h-4 w-4" />
                    Add Funds
                  </button>
                </Link>
                <Link href="/dashboard/transactions">
                  <button className="flex items-center gap-2 border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200">
                    <History className="h-4 w-4" />
                    History
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats column */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Total Orders */}
            <div className="rounded-2xl border border-gray-300 bg-white p-5 flex items-center justify-between group hover:border-blue-300 transition-all duration-300">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Total Orders</p>
                {loading ? (
                  <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-black text-gray-900">{stats.totalOrders}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">All time</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>

            {/* This Month */}
            <div className="rounded-2xl border border-gray-300 bg-white p-5 flex items-center justify-between group hover:border-amber-300 transition-all duration-300">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">This Month</p>
                {loading ? (
                  <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-black text-gray-900">{stats.thisMonthOrders}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">Orders</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>

            {/* Total Spent */}
            <div className="rounded-2xl border border-gray-300 bg-white p-5 flex items-center justify-between group hover:border-emerald-300 transition-all duration-300 sm:col-span-2 lg:col-span-1">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Total Spent</p>
                {loading ? (
                  <div className="h-7 w-24 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-black text-gray-900">₵{stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">Lifetime</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* ── ACTIONS + QUICK BUY ROW ───────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/dashboard/buy-data" className="group">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col items-center justify-center gap-2.5 text-center hover:border-cyan-300 hover:bg-cyan-50 transition-all duration-300 cursor-pointer min-h-[96px]">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center group-hover:bg-cyan-100 group-hover:scale-110 transition-all duration-200">
                <Wifi className="h-5 w-5 text-cyan-600" />
              </div>
              <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Buy Data</span>
            </div>
          </Link>

          <Link href="/dashboard/wallet" className="group">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col items-center justify-center gap-2.5 text-center hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-300 cursor-pointer min-h-[96px]">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-110 transition-all duration-200">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Wallet</span>
            </div>
          </Link>

          <Link href="/dashboard/orders" className="group">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col items-center justify-center gap-2.5 text-center hover:border-violet-300 hover:bg-violet-50 transition-all duration-300 cursor-pointer min-h-[96px]">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center group-hover:bg-violet-100 group-hover:scale-110 transition-all duration-200">
                <Eye className="h-5 w-5 text-violet-600" />
              </div>
              <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Orders</span>
            </div>
          </Link>

          <div className="group rounded-2xl border border-gray-200 bg-white p-4 flex flex-col justify-center gap-2 hover:border-fuchsia-300 hover:bg-fuchsia-50 transition-all duration-300 min-h-[96px]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Zap className="h-3 w-3 text-fuchsia-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-600">Quick Buy</span>
            </div>
            <Select
              onValueChange={(value) => {
                router.push(`/dashboard/buy-data?network=${encodeURIComponent(value)}`)
              }}
            >
              <SelectTrigger className="h-8 w-full bg-transparent border-gray-200 text-gray-700 text-xs hover:border-fuchsia-300 transition-colors focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Pick network…" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-800">
                {networks.map((network) => (
                  <SelectItem key={network.id} value={network.name} className="text-xs hover:bg-gray-100">
                    {network.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── RECENT ORDERS ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
                <p className="text-[11px] text-gray-500">Latest transactions</p>
              </div>
            </div>
            {recentOrders.length > 0 && (
              <Link href="/dashboard/orders">
                <button className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors group">
                  View all
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-gray-200">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-2/5" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                  </div>
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-4">
                <ShoppingCart className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500 mb-1">No orders yet</p>
              <p className="text-xs text-gray-400 mb-5">Your recent data purchases will appear here</p>
              <Link href="/dashboard/buy-data">
                <button className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200">
                  <Wifi className="h-4 w-4" />
                  Buy Data Now
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentOrders.map((order, index) => {
                const cfg = getStatusConfig(order.status)
                const StatusIcon = cfg.icon
                const dataLabel = order.dataAmount >= 1024
                  ? `${(order.dataAmount / 1024).toFixed(1)} GB`
                  : `${order.dataAmount} MB`

                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Status icon */}
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border ${cfg.bg} ${cfg.border}`}>
                      <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">{order.plan}</span>
                        <span className="hidden sm:inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200">
                          <Signal className="h-2.5 w-2.5" />
                          {formatNetworkName(order.network)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="font-mono">{order.phone}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="font-semibold text-gray-500">{dataLabel}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
                        <span className="hidden sm:block">
                          {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Amount + Status */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-black text-gray-900 mb-1">
                        ₵{order.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}

              <div className="px-5 sm:px-6 py-3">
                <Link href="/dashboard/orders">
                  <button className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-cyan-600 transition-colors py-1.5 rounded-lg hover:bg-gray-100 group">
                    View all orders
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
