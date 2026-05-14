'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useNetworks } from '@/hooks/use-networks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Wifi,
  CreditCard,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Zap,
  Search,
  Wallet,
  Clock,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Signal,
  X,
  ArrowUpDown,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { formatNetworkName } from '@/lib/utils'
import Image from 'next/image'

type Plan = {
  id: string
  name: string
  description: string
  price: number
  effectivePrice?: number
  dataAmount: number
  validity: number
  network: string
  isActive: boolean
}

type SortKey = 'price-asc' | 'price-desc' | 'data-asc' | 'data-desc'

function BuyDataPageContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [selectedPlan, setSelectedPlan] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isOrderConfirmModalOpen, setIsOrderConfirmModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{
    planName: string
    network: string
    phone: string
    dataSize: string
  } | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [err, setErr] = useState('')
  const [phoneNumberError, setPhoneNumberError] = useState('')
  const [networks, setNetworks] = useState<Array<{ id: string; name: string }>>([])
  const [dataPlans, setDataPlans] = useState<Plan[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState('MTN')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('data-asc')

  const { networks: cachedNetworks } = useNetworks()

  useEffect(() => {
    if (cachedNetworks.length > 0) {
      setNetworks([{ id: 'all', name: 'All' }, ...cachedNetworks])
    }
  }, [cachedNetworks])

  useEffect(() => {
    const fetchDataPlans = async () => {
      try {
        const res = await fetch('/api/data-plans')
        if (res.ok) {
          const data = await res.json()
          setDataPlans((data.data || []).map((p: any) => ({ ...p, price: p.effectivePrice ?? p.price })))
        }
      } catch (error) {
        console.error('Error fetching data plans:', error)
      }
    }

    fetchDataPlans()
  }, [])

  useEffect(() => {
    const networkParam = searchParams.get('network')
    if (networkParam && networks.some((n) => n.name === networkParam)) {
      setSelectedNetwork(networkParam)
    }
  }, [searchParams, networks])

  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setWalletBalance(Number(data.data.walletBalance || 0))
      } catch {}
    }
    fetchBalance()
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const networkCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    dataPlans.forEach((p) => {
      if (!p.isActive) return
      counts[p.network] = (counts[p.network] || 0) + 1
    })
    return counts
  }, [dataPlans])

  const filteredPlans = useMemo(() => {
    const base =
      selectedNetwork === 'All'
        ? dataPlans.filter((p) => p.isActive)
        : dataPlans.filter((p) => p.network === selectedNetwork && p.isActive)

    const q = search.trim().toLowerCase()
    const searched = q
      ? base.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            String(p.dataAmount).includes(q),
        )
      : base

    const sorted = [...searched].sort((a, b) => {
      switch (sortKey) {
        case 'price-asc':
          return Number(a.price) - Number(b.price)
        case 'price-desc':
          return Number(b.price) - Number(a.price)
        case 'data-desc':
          return Number(b.dataAmount) - Number(a.dataAmount)
        case 'data-asc':
        default:
          return Number(a.dataAmount) - Number(b.dataAmount)
      }
    })
    return sorted
  }, [dataPlans, selectedNetwork, search, sortKey])

  const selectedPlanData = dataPlans.find((plan) => plan.id === selectedPlan)

  const handleSuccessModalChange = (open: boolean) => {
    if (!open) {
      setSuccessDetails(null)
    }
    setIsSuccessModalOpen(open)
  }

  const isPhoneNumberValid = (): boolean => {
    const phone = phoneNumber.trim()
    if (!phone) return false
    if (phone.length > 10) return false
    if (!/^0\d{9}$/.test(phone)) return false
    return true
  }

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setPhoneNumber(value)

    if (!value.trim()) {
      setPhoneNumberError('Phone number is required')
    } else if (value.length > 10) {
      setPhoneNumberError('Phone number must be exactly 10 digits')
    } else if (!/^0\d{9}$/.test(value)) {
      if (value.length === 10 && !value.startsWith('0')) {
        setPhoneNumberError('Phone number must start with 0')
      } else if (value.length < 10) {
        setPhoneNumberError('')
      } else {
        setPhoneNumberError('Phone number must be exactly 10 digits and start with 0')
      }
    } else {
      setPhoneNumberError('')
    }
  }

  const formatData = (amountMb: number) => {
    if (amountMb >= 1024) {
      const gb = amountMb / 1024
      return {
        value: gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1),
        unit: 'GB',
      }
    }
    return { value: String(amountMb), unit: 'MB' }
  }

  type Brand = {
    key: 'mtn' | 'telecel' | 'airteltigo' | 'other'
    label: string
    chipBg: string
    chipText: string
    ring: string
    gradient: string
    accent: string
    softBg: string
  }

  const getBrand = (network: string): Brand => {
    const normalized = network.trim().toLowerCase()
    const isAT =
      normalized.includes('at') ||
      normalized.includes('airteltigo') ||
      normalized.includes('ishare') ||
      normalized.includes('bigtime')
    if (normalized === 'mtn') {
      return {
        key: 'mtn',
        label: 'MTN',
        chipBg: 'bg-yellow-100',
        chipText: 'text-yellow-800',
        ring: 'ring-yellow-400',
        gradient: 'from-yellow-400 via-amber-400 to-yellow-500',
        accent: 'bg-yellow-500',
        softBg: 'bg-yellow-50',
      }
    }
    if (normalized === 'telecel') {
      return {
        key: 'telecel',
        label: 'Telecel',
        chipBg: 'bg-red-100',
        chipText: 'text-red-800',
        ring: 'ring-red-400',
        gradient: 'from-red-500 via-rose-500 to-red-600',
        accent: 'bg-red-500',
        softBg: 'bg-red-50',
      }
    }
    if (isAT) {
      return {
        key: 'airteltigo',
        label: 'AirtelTigo',
        chipBg: 'bg-blue-100',
        chipText: 'text-blue-800',
        ring: 'ring-blue-400',
        gradient: 'from-blue-500 via-sky-500 to-indigo-600',
        accent: 'bg-blue-500',
        softBg: 'bg-blue-50',
      }
    }
    return {
      key: 'other',
      label: network,
      chipBg: 'bg-gray-100',
      chipText: 'text-gray-700',
      ring: 'ring-gray-400',
      gradient: 'from-gray-500 to-gray-600',
      accent: 'bg-gray-500',
      softBg: 'bg-gray-50',
    }
  }

  const totalActivePlans = useMemo(() => dataPlans.filter((p) => p.isActive).length, [dataPlans])

  return (
    <DashboardLayout title="Buy Data Bundle">
      <div className="space-y-6 sm:space-y-8 pb-24 lg:pb-0">
        {/* Back nav */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs sm:text-sm text-gray-500">Back to Dashboard</span>
        </div>

        {/* Hero banner */}
        {/* <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-700 p-6 sm:p-8 text-white shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="pointer-events-none absolute right-6 top-6 hidden sm:block">
            <Signal className="h-24 w-24 text-white/10" strokeWidth={1.25} />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-3 lg:items-end">
            <div className="lg:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Lightning-fast data delivery
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                Stay connected. Stay unstoppable.
              </h1>
              <p className="text-sm sm:text-base text-white/80 max-w-xl">
                Pick the perfect bundle for any network in Ghana. Instant activation, transparent prices, zero stress.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs backdrop-blur">
                  <Wifi className="h-3.5 w-3.5" />
                  {totalActivePlans} active plans
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs backdrop-blur">
                  <Zap className="h-3.5 w-3.5" />
                  Auto top-up in seconds
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 sm:p-5 backdrop-blur-md ring-1 ring-white/20">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                  <Wallet className="h-3.5 w-3.5" /> Wallet Balance
                </span>
                <Link
                  href="/dashboard/wallet"
                  className="text-[11px] font-medium text-white/80 hover:text-white inline-flex items-center gap-1"
                >
                  Top up <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-bold">
                  ₵{walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (walletBalance / 100) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section> */}

        {/* Toolbar: search + sort */}
        {/* <section className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plans by name or size (e.g. 5GB)"
                className="pl-9 pr-9 h-11 rounded-xl"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
              <div className="flex items-center gap-1.5 text-gray-500 shrink-0">
                <ArrowUpDown className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Sort</span>
              </div>
              {(
                [
                  { k: 'data-asc', label: 'Data ↑' },
                  { k: 'data-desc', label: 'Data ↓' },
                  { k: 'price-asc', label: 'Price ↑' },
                  { k: 'price-desc', label: 'Price ↓' },
                ] as { k: SortKey; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setSortKey(opt.k)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    sortKey === opt.k
                      ? 'bg-gray-900 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section> */}

        {/* Network chips */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
              <Signal className="h-4 w-4 text-gray-500" /> Choose a network
            </h2>
            {selectedNetwork !== 'All' && (
              <button
                onClick={() => {
                  setSelectedNetwork('All')
                  setSelectedPlan('')
                }}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Show all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {networks.map((net) => {
              const brand = getBrand(net.name)
              const isActive = selectedNetwork === net.name
              const count = net.name === 'All' ? totalActivePlans : networkCounts[net.name] || 0
              return (
                <button
                  key={net.id}
                  onClick={() => {
                    setSelectedNetwork(net.name)
                    setSelectedPlan('')
                  }}
                  type="button"
                  className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-transparent bg-gradient-to-br ' + brand.gradient + ' text-white shadow-lg'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] uppercase tracking-wider ${
                          isActive ? 'text-white/80' : 'text-gray-400'
                        }`}
                      >
                        Network
                      </div>
                      <div className={`font-semibold ${isActive ? 'text-white' : 'text-gray-900'}`}>
                        {formatNetworkName(net.name)}
                      </div>
                    </div>
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        isActive ? 'bg-white/20' : brand.softBg
                      }`}
                    >
                      <Signal
                        className={`h-4 w-4 ${isActive ? 'text-white' : brand.chipText}`}
                        strokeWidth={2.2}
                      />
                    </div>
                  </div>
                  <div
                    className={`mt-3 text-xs ${
                      isActive ? 'text-white/85' : 'text-gray-500'
                    }`}
                  >
                    {count} {count === 1 ? 'plan' : 'plans'} available
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Plans + sticky selection */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedNetwork === 'All' ? 'All bundles' : `${formatNetworkName(selectedNetwork)} bundles`}
              </h2>
              <span className="text-xs text-gray-500">
                {filteredPlans.length} {filteredPlans.length === 1 ? 'result' : 'results'}
              </span>
            </div>

            {filteredPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Wifi className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No plans match your filter</p>
                <p className="mt-1 text-xs text-gray-500">Try a different network or clear the search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {filteredPlans.map((plan) => {
                  const brand = getBrand(plan.network)
                  const { value, unit } = formatData(plan.dataAmount)
                  const isSelected = selectedPlan === plan.id
                  return (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlan(plan.id)
                        setIsOpen(true)
                      }}
                      type="button"
                      className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                        isSelected
                          ? `ring-2 ${brand.ring} shadow-lg`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Network color strip */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${brand.gradient}`} />

                      {/* Decorative corner */}
                      <div
                        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl bg-gradient-to-br ${brand.gradient}`}
                      />

                      <div className="relative p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                          <Badge className={`${brand.chipBg} ${brand.chipText} text-[10px] font-medium border-0`}>
                            {formatNetworkName(plan.network)}
                          </Badge>
                          {isSelected && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Big data amount */}
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-none">
                            {value}
                          </span>
                          <span className="text-lg font-bold text-gray-500">{unit}</span>
                        </div>

                        <div className="mt-2 line-clamp-2 text-xs text-gray-500 min-h-[2rem]">
                          {plan.description || plan.name}
                        </div>

                        {/* Footer: price + validity */}
                        <div className="mt-4 flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
                          <div className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <Clock className="h-3 w-3" />
                            {plan.validity ? `${plan.validity} days` : 'No expiry'}
                          </div>
                          <div className="text-base font-bold text-gray-900">
                            ₵{plan.price}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sticky selection panel (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-gray-900 px-5 py-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                      <ShoppingBag className="h-3.5 w-3.5" /> Your selection
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {selectedPlanData ? selectedPlanData.name : 'No plan selected yet'}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {selectedPlanData ? (
                    <>
                      <div className="flex items-center justify-between">
                        <Badge
                          className={`${getBrand(selectedPlanData.network).chipBg} ${
                            getBrand(selectedPlanData.network).chipText
                          } border-0`}
                        >
                          {formatNetworkName(selectedPlanData.network)}
                        </Badge>
                        <div className="text-right">
                          <div className="text-2xl font-extrabold text-gray-900 leading-none">
                            {formatData(selectedPlanData.dataAmount).value}
                            <span className="text-base font-bold text-gray-500 ml-0.5">
                              {formatData(selectedPlanData.dataAmount).unit}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1">
                            {selectedPlanData.validity ? `${selectedPlanData.validity} days` : 'No expiry'}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Price</span>
                          <span className="font-semibold text-gray-900">₵{selectedPlanData.price}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Wallet</span>
                          <span className="font-semibold text-gray-900">
                            ₵{walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
                          <span className="text-gray-600 font-medium">After purchase</span>
                          <span
                            className={`font-bold ${
                              walletBalance - selectedPlanData.price < 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            ₵{(walletBalance - selectedPlanData.price).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      <Button className="w-full h-11 rounded-xl" onClick={() => setIsOpen(true)}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Continue to checkout
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-6 space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <ShoppingBag className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600">
                        Tap a data plan to see details and continue to checkout.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tips card */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-900">Pro tip</p>
                    <p className="text-[11px] text-blue-800/80 mt-0.5">
                      Bundles activate instantly once your order is confirmed. Make sure the recipient number is correct.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Mobile sticky checkout bar */}
        {selectedPlanData && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur p-3 shadow-2xl lg:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-gray-900">{selectedPlanData.name}</div>
                <div className="text-xs text-gray-500">
                  {formatData(selectedPlanData.dataAmount).value}
                  {formatData(selectedPlanData.dataAmount).unit} • ₵{selectedPlanData.price}
                </div>
              </div>
              <Button onClick={() => setIsOpen(true)} className="rounded-xl">
                Checkout <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Phone entry modal */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) setPhoneNumberError('')
        }}
      >
        <DialogContent className="sm:max-w-[480px] mx-4">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              Review and confirm your data purchase. Funds will be deducted from your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedPlanData ? (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-600">Please select a data plan first.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-gray-900">
                        {selectedPlanData.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatData(selectedPlanData.dataAmount).value}
                        {formatData(selectedPlanData.dataAmount).unit}
                      </div>
                    </div>
                    <Badge
                      className={`${getBrand(selectedPlanData.network).chipBg} ${
                        getBrand(selectedPlanData.network).chipText
                      } text-xs ml-2 border-0`}
                    >
                      {formatNetworkName(selectedPlanData.network)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm text-gray-700">
                    Phone Number <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0541234567"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    onBlur={() => {
                      if (phoneNumber.trim() && !isPhoneNumberValid()) {
                        const phone = phoneNumber.trim()
                        if (phone.length > 10) {
                          setPhoneNumberError('Phone number must be exactly 10 digits')
                        } else if (!/^0\d{9}$/.test(phone)) {
                          setPhoneNumberError('Phone number must be exactly 10 digits and start with 0')
                        }
                      }
                    }}
                    className="mt-2"
                  />
                  {phoneNumberError && <p className="text-red-600 text-xs mt-1">{phoneNumberError}</p>}
                </div>
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Wallet Balance</span>
                    <span className="font-semibold text-gray-900">
                      ₵{walletBalance.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold text-gray-900">₵{selectedPlanData.price}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base">
                    <span className="text-gray-600 font-medium">Total</span>
                    <span className="text-lg font-bold text-gray-900">₵{selectedPlanData.price}</span>
                  </div>
                </div>
                {err && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-600">{err}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setPhoneNumberError('')
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!selectedPlanData || !phoneNumber || !isPhoneNumberValid() || isPurchasing}
              onClick={() => {
                setIsOpen(false)
                setIsOrderConfirmModalOpen(true)
              }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Purchase with Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order confirmation modal */}
      <Dialog
        open={isOrderConfirmModalOpen}
        onOpenChange={(open) => {
          setIsOrderConfirmModalOpen(open)
          if (!open) setErr('')
        }}
      >
        <DialogContent className="sm:max-w-[500px] mx-4">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Confirm Order Details
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              Please review your order details before confirming. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPlanData ? (
              <>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Network</span>
                      <Badge
                        className={`${getBrand(selectedPlanData.network).chipBg} ${
                          getBrand(selectedPlanData.network).chipText
                        } text-xs border-0`}
                      >
                        {formatNetworkName(selectedPlanData.network)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Data Size</span>
                      <span className="font-semibold text-gray-900">
                        {formatData(selectedPlanData.dataAmount).value}
                        {formatData(selectedPlanData.dataAmount).unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                      <span className="text-sm text-gray-500">Phone Number</span>
                      <span className="font-semibold text-gray-900">{phoneNumber}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Current Wallet Balance</span>
                    <span className="font-semibold text-gray-900">
                      ₵{walletBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Order Amount</span>
                    <span className="font-semibold text-gray-900">₵{selectedPlanData.price}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base">
                    <span className="text-gray-600 font-medium">Balance After Purchase</span>
                    <span
                      className={`text-lg font-bold ${
                        walletBalance - selectedPlanData.price < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      ₵{(walletBalance - selectedPlanData.price).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
                {err && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-600">{err}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-600">
                  No plan selected. Please go back and select a plan.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsOrderConfirmModalOpen(false)
                setErr('')
                setIsOpen(true)
              }}
              className="w-full sm:w-auto"
              disabled={isPurchasing}
            >
              Cancel
            </Button>
            <Button
              className="w-full bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg transition-all duration-300 hover:from-emerald-700 hover:to-green-800 hover:shadow-xl sm:w-auto"
              disabled={!selectedPlanData || isPurchasing}
              onClick={async () => {
                try {
                  setErr('')
                  setIsPurchasing(true)
                  const res = await fetch('/api/orders/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId: selectedPlanData?.id, phoneNumber }),
                  })

                  let data: any = {}
                  const contentType = res.headers.get('content-type')
                  if (contentType && contentType.includes('application/json')) {
                    try {
                      data = await res.json()
                    } catch (jsonError) {
                      throw new Error(`Server error (${res.status})`)
                    }
                  } else {
                    const text = await res.text()
                    throw new Error(text || `Server error (${res.status})`)
                  }

                  if (!res.ok) {
                    const errorMsg = data?.error || data?.message || `Purchase failed (${res.status})`
                    setErr(errorMsg)
                    toast({
                      title: 'Purchase Failed',
                      description: errorMsg,
                      variant: 'destructive',
                    })
                    return
                  }

                  setIsOrderConfirmModalOpen(false)
                  if (selectedPlanData) {
                    const { value, unit } = formatData(selectedPlanData.dataAmount)
                    setSuccessDetails({
                      planName: selectedPlanData.name,
                      network: formatNetworkName(selectedPlanData.network),
                      phone: phoneNumber,
                      dataSize: `${value}${unit}`,
                    })
                  } else {
                    setSuccessDetails({
                      planName: 'Data Bundle',
                      network: '—',
                      phone: phoneNumber,
                      dataSize: '—',
                    })
                  }
                  setIsSuccessModalOpen(true)
                  setSelectedPlan('')
                  setPhoneNumber('')
                  setPhoneNumberError('')
                } catch (e: any) {
                  const errorMsg = e?.message || 'An unexpected error occurred. Please try again.'
                  setErr(errorMsg)
                  toast({
                    title: 'Error',
                    description: errorMsg,
                    variant: 'destructive',
                  })
                } finally {
                  setIsPurchasing(false)
                }
              }}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Order...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm & Place Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={handleSuccessModalChange}>
        <DialogContent className="sm:max-w-[420px] mx-4">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-xl font-semibold text-gray-900">Purchase Successful</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Your data bundle is being processed. You will receive a confirmation SMS shortly.
              </DialogDescription>
            </DialogHeader>
          </div>

          {successDetails && (
            <div className="mt-6 w-full space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Network</span>
                <span className="font-semibold text-gray-900">{successDetails.network}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Phone</span>
                <span className="font-semibold text-gray-900">{successDetails.phone}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Data size</span>
                <span className="font-semibold text-gray-900">{successDetails.dataSize}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/orders">View orders</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleSuccessModalChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

export default function BuyDataPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Buy Data Bundle" subtitle="Loading...">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          </div>
        </DashboardLayout>
      }
    >
      <BuyDataPageContent />
    </Suspense>
  )
}
