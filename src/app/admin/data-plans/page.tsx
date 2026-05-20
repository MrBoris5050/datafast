'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Wifi, 
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Power,
  PowerOff
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNetworkName } from '@/lib/utils'
import { getPlanPriceForRole } from '@/lib/pricing'
import { UserRole } from '@prisma/client'

interface DataPlan {
  id: string
  name: string
  description?: string
  price?: number
  priceCustomer: number
  priceAgent: number
  priceWholesaler: number
  priceDealer: number
  dataAmount: number
  validity: number
  network: string
  /** DataDash GH / similar: upstream `plan_id` for the bundle */
  providerPlanId?: string | null
  isActive: boolean
  createdAt: string
}

type PlanDraft = {
  priceCustomer: string
  priceAgent: string
  priceWholesaler: string
  priceDealer: string
}

function NetworkGroupHeader({
  network,
  plans,
  isSaving,
  hasChanges,
  onSave,
  onReset,
}: {
  network: string
  plans: DataPlan[]
  isSaving: boolean
  hasChanges: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3">
        <NetworkBadgeStatic network={network} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{formatNetworkName(network)}</h3>
          <p className="text-sm text-gray-500">{plans.length} plan{plans.length === 1 ? '' : 's'}</p>
        </div>
        {hasChanges && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <AlertCircle className="h-3 w-3" />
            Unsaved changes
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isSaving}
            className="h-8 px-3 text-xs"
          >
            Reset All
          </Button>
        )}
        <Button
          size="sm"
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          className="h-8 px-4 text-xs disabled:opacity-40"
        >
          {isSaving ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
          ) : (
            <>Save All Prices</>
          )}
        </Button>
      </div>
    </div>
  )
}

function NetworkBadgeStatic({ network }: { network: string }) {
  const displayName = formatNetworkName(network)
  switch (network) {
    case 'MTN':
      return <Badge className="bg-yellow-50 text-yellow-600 border-0">{displayName}</Badge>
    case 'Vodafone':
      return <Badge className="bg-red-50 text-red-600 border-0">{displayName}</Badge>
    case 'AirtelTigo':
    case 'AT BIGTIME':
    case 'AT ISHARE':
      return <Badge className="bg-emerald-50 text-emerald-600 border-0">{displayName}</Badge>
    case 'TELECEL':
      return <Badge className="bg-red-50 text-red-600 border-0">{displayName}</Badge>
    default:
      return <Badge className="bg-gray-100 text-gray-500 border-0">{displayName}</Badge>
  }
}

export default function AdminDataPlansPage() {
  const { data: session } = useSession()
  const userRole = (session?.user?.role as UserRole) || 'CUSTOMER'
  const [networks, setNetworks] = useState<Array<{ id: string; name: string }>>([])
  const [editingNetworkId, setEditingNetworkId] = useState<string | null>(null)
  const [editingNetworkName, setEditingNetworkName] = useState('')
  const [newNetwork, setNewNetwork] = useState('')
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [networkSyncStatus, setNetworkSyncStatus] = useState<any>(null)
  const [isSyncingNetworks, setIsSyncingNetworks] = useState(false)
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [networkFilter, setNetworkFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'dataAmount' | 'validity' | 'network'>('dataAmount')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<DataPlan | null>(null)
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({})
  const [savingPlanMap, setSavingPlanMap] = useState<Record<string, boolean>>({})
  const [savingNetworkMap, setSavingNetworkMap] = useState<Record<string, boolean>>({})

  const planLookup = useMemo(() => {
    const map: Record<string, DataPlan> = {}
    dataPlans.forEach(plan => {
      map[plan.id] = plan
    })
    return map
  }, [dataPlans])

  const createPlanDraft = (plan: DataPlan): PlanDraft => ({
    priceCustomer: plan.priceCustomer !== undefined ? String(plan.priceCustomer) : '0',
    priceAgent: plan.priceAgent !== undefined ? String(plan.priceAgent) : '0',
    priceWholesaler: plan.priceWholesaler !== undefined ? String(plan.priceWholesaler) : '0',
    priceDealer: plan.priceDealer !== undefined ? String(plan.priceDealer) : '0'
  })

  useEffect(() => {
    if (dataPlans.length === 0) {
      setPlanDrafts({})
      return
    }
    setPlanDrafts(prev => {
      const next: Record<string, PlanDraft> = {}
      dataPlans.forEach(plan => {
        const existing = prev[plan.id]
        if (existing) {
          next[plan.id] = existing
        } else {
          next[plan.id] = createPlanDraft(plan)
        }
      })
      return next
    })
  }, [dataPlans])

  const normalizePrice = (value: string | number | undefined) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return 0
      const parsed = parseFloat(trimmed)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  const handlePlanDraftChange = (planId: string, field: keyof PlanDraft, value: string) => {
    setPlanDrafts(prev => {
      const existing = prev[planId] ?? (planLookup[planId] ? createPlanDraft(planLookup[planId]) : {
        priceCustomer: '0',
        priceAgent: '0',
        priceWholesaler: '0',
        priceDealer: '0'
      })
      return {
        ...prev,
        [planId]: {
          ...existing,
          [field]: value
        }
      }
    })
  }

  const resetPlanDraft = (planId: string) => {
    const plan = planLookup[planId]
    if (!plan) return
    setPlanDrafts(prev => ({
      ...prev,
      [planId]: createPlanDraft(plan)
    }))
  }

  const hasPlanPriceChanges = (plan: DataPlan) => {
    const draft = planDrafts[plan.id]
    if (!draft) return false

    const customerChanged = normalizePrice(draft.priceCustomer) !== normalizePrice(plan.priceCustomer)
    const agentChanged = normalizePrice(draft.priceAgent) !== normalizePrice(plan.priceAgent)
    const wholesalerChanged = normalizePrice(draft.priceWholesaler) !== normalizePrice(plan.priceWholesaler)
    const dealerChanged = normalizePrice(draft.priceDealer) !== normalizePrice(plan.priceDealer)

    return customerChanged || agentChanged || wholesalerChanged || dealerChanged
  }

  const handleSavePlanPrices = async (planId: string) => {
    const plan = planLookup[planId]
    const draft = planDrafts[planId]
    if (!plan || !draft) return

    const payload = {
      priceCustomer: normalizePrice(draft.priceCustomer),
      priceAgent: normalizePrice(draft.priceAgent),
      priceWholesaler: normalizePrice(draft.priceWholesaler),
      priceDealer: normalizePrice(draft.priceDealer)
    }

    setSavingPlanMap(prev => ({ ...prev, [planId]: true }))

    try {
      const response = await fetch(`/api/admin/data-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to update prices')
        return
      }

      const data = await response.json()
      const updatedPlan: DataPlan = {
        id: data.data.id,
        name: data.data.name,
        description: data.data.description,
        price: data.data.price || 0,
        priceCustomer: Number(data.data.priceCustomer || 0),
        priceAgent: Number(data.data.priceAgent || 0),
        priceWholesaler: Number(data.data.priceWholesaler || 0),
        priceDealer: Number(data.data.priceDealer || 0),
        dataAmount: data.data.dataAmount,
        validity: data.data.validity,
        network: data.data.network || plan.network,
        isActive: data.data.isActive,
        createdAt: data.data.createdAt
      }

      setDataPlans(prev =>
        prev.map(item => (item.id === planId ? updatedPlan : item))
      )
      setPlanDrafts(prev => ({
        ...prev,
        [planId]: createPlanDraft(updatedPlan)
      }))
    } catch (error) {
      console.error('Error updating prices:', error)
      alert('Failed to update prices')
    } finally {
      setSavingPlanMap(prev => {
        const { [planId]: _, ...rest } = prev
        return rest
      })
    }
  }

  const hasNetworkPriceChanges = (plans: DataPlan[]) =>
    plans.some(plan => hasPlanPriceChanges(plan))

  const resetNetworkDrafts = (plans: DataPlan[]) => {
    setPlanDrafts(prev => {
      const next = { ...prev }
      plans.forEach(plan => { next[plan.id] = createPlanDraft(plan) })
      return next
    })
  }

  const handleSaveNetworkPrices = async (networkName: string, plans: DataPlan[]) => {
    const dirtyPlans = plans.filter(plan => hasPlanPriceChanges(plan))
    if (dirtyPlans.length === 0) return

    setSavingNetworkMap(prev => ({ ...prev, [networkName]: true }))

    try {
      const results = await Promise.allSettled(
        dirtyPlans.map(async (plan) => {
          const draft = planDrafts[plan.id]
          if (!draft) throw new Error('No draft')
          const payload = {
            priceCustomer: normalizePrice(draft.priceCustomer),
            priceAgent: normalizePrice(draft.priceAgent),
            priceWholesaler: normalizePrice(draft.priceWholesaler),
            priceDealer: normalizePrice(draft.priceDealer),
          }
          const response = await fetch(`/api/admin/data-plans/${plan.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!response.ok) throw new Error(`Failed to update ${plan.name}`)
          const data = await response.json()
          return data.data
        })
      )

      const updatedPlans: DataPlan[] = []
      const failed: string[] = []

      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          const d = result.value
          updatedPlans.push({
            id: d.id,
            name: d.name,
            description: d.description,
            price: d.price || 0,
            priceCustomer: Number(d.priceCustomer || 0),
            priceAgent: Number(d.priceAgent || 0),
            priceWholesaler: Number(d.priceWholesaler || 0),
            priceDealer: Number(d.priceDealer || 0),
            dataAmount: d.dataAmount,
            validity: d.validity,
            network: d.network || dirtyPlans[i].network,
            isActive: d.isActive,
            createdAt: d.createdAt,
          })
        } else if (result.status === 'rejected') {
          failed.push(dirtyPlans[i].name)
        }
      })

      if (updatedPlans.length > 0) {
        const updatedById = Object.fromEntries(updatedPlans.map(p => [p.id, p]))
        setDataPlans(prev => prev.map(p => updatedById[p.id] ?? p))
        setPlanDrafts(prev => {
          const next = { ...prev }
          updatedPlans.forEach(p => { next[p.id] = createPlanDraft(p) })
          return next
        })
      }

      if (failed.length > 0) {
        alert(`Failed to save: ${failed.join(', ')}`)
      }
    } catch (error) {
      console.error('Error saving network prices:', error)
      alert('Failed to save prices')
    } finally {
      setSavingNetworkMap(prev => {
        const { [networkName]: _, ...rest } = prev
        return rest
      })
    }
  }

  const formatDataSizeGB = (amount: number) => {
    if (!amount || amount <= 0) return '0 GB'
    const gb = amount / 1024
    if (gb >= 1) {
      return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(2)} GB`
    }
    return `${gb.toFixed(2)} GB`
  }

  const renderPlanCard = (plan: DataPlan) => {
    const draft = planDrafts[plan.id] ?? createPlanDraft(plan)
    const isDirty = hasPlanPriceChanges(plan)

    const priceRow = (
      label: string,
      field: keyof PlanDraft,
      dotColor: string,
      inputColor: string
    ) => (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 w-20 shrink-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs font-medium text-gray-500">{label}</span>
        </div>
        <div className="relative flex-1">
          <span className={`pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs font-bold ${inputColor}`}>
            ₵
          </span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={draft?.[field] ?? ''}
            onChange={(e) => handlePlanDraftChange(plan.id, field, e.target.value)}
            placeholder="0.00"
            className="pl-6 h-8 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
        </div>
      </div>
    )

    return (
      <div
        key={plan.id}
        className="bg-white flex flex-col rounded-2xl border border-gray-200 p-4 shadow-lg backdrop-blur transition-all hover:border-gray-300 hover:shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">{plan.name || formatNetworkName(plan.network)}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{formatDataSizeGB(plan.dataAmount)}</span>
                {plan.validity > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{plan.validity}d</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={`text-xs px-2 py-0.5 ${plan.isActive
                ? 'bg-emerald-50 text-emerald-600 border-0'
                : 'bg-gray-100 text-gray-500 border-0'
              }`}
            >
              {plan.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTogglePlanStatus(plan.id)}
              className={`h-7 w-7 p-0 ${plan.isActive
                ? 'text-red-600 hover:bg-red-50'
                : 'text-emerald-600 hover:bg-emerald-50'
              }`}
              title={plan.isActive ? 'Deactivate' : 'Activate'}
            >
              {plan.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Pricing rows */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pricing</span>
            {isDirty && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Unsaved
              </span>
            )}
          </div>
          {priceRow('Customer', 'priceCustomer', 'bg-blue-500', 'text-blue-600')}
          {priceRow('Agent', 'priceAgent', 'bg-emerald-500', 'text-emerald-600')}
          {/* {priceRow('Wholesaler', 'priceWholesaler', 'bg-orange-500', 'text-orange-600')} */}
          {/* {priceRow('Dealer', 'priceDealer', 'bg-purple-500', 'text-purple-600')} */}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingPlan(plan)
              setIsEditDialogOpen(true)
            }}
            className="h-8 w-8 p-0"
            title="Edit details"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeletePlan(plan.id)}
            className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            title="Delete plan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    providerPlanId: '',
    priceCustomer: 0,
    priceAgent: 0,
    priceWholesaler: 0,
    priceDealer: 0,
    dataAmount: 0,
    validity: 0,
    network: '',
    isActive: true
  })

  useEffect(() => {
    fetchDataPlans()
    loadNetworks()
    checkNetworkSync()
  }, [])

  const checkNetworkSync = async () => {
    try {
      const response = await fetch('/api/admin/networks/sync')
      if (response.ok) {
        const data = await response.json()
        setNetworkSyncStatus(data.data)
      }
    } catch (error) {
      console.error('Error checking network sync:', error)
    }
  }

  const syncNetworks = async () => {
    setIsSyncingNetworks(true)
    try {
      const response = await fetch('/api/admin/networks/sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Networks synced successfully')
        await loadNetworks()
        await checkNetworkSync()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to sync networks')
      }
    } catch (error) {
      console.error('Error syncing networks:', error)
      alert('Failed to sync networks')
    } finally {
      setIsSyncingNetworks(false)
    }
  }

  // Set default network when networks are loaded (only once)
  useEffect(() => {
    if (networks.length > 0 && newPlan.network === '') {
      setNewPlan(prev => ({ ...prev, network: networks[0].name }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networks])

  const fetchDataPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/data-plans', { cache: 'no-store' })
      
      if (!response.ok) {
        if (response.status === 401) {
          setDataPlans([])
          return
        }
        throw new Error('Failed to fetch data plans')
      }
      
      const data = await response.json()
      if (data?.data) {
        // Transform the data to match the expected format
        const transformedPlans = data.data.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: Number(plan.price || 0),
          priceCustomer: Number(plan.priceCustomer ?? plan.price ?? 0),
          priceAgent: Number(plan.priceAgent ?? 0),
          priceWholesaler: Number(plan.priceWholesaler ?? 0),
          priceDealer: Number(plan.priceDealer ?? 0),
          dataAmount: plan.dataAmount,
          validity: plan.validity,
          providerPlanId: plan.providerPlanId ?? null,
          network: plan.network || 'Unknown',
          isActive: plan.isActive,
          createdAt: plan.createdAt
        }))
        setDataPlans(transformedPlans)
      }
    } catch (error) {
      console.error('Error fetching data plans:', error)
      setDataPlans([])
    } finally {
      setLoading(false)
    }
  }

  const getNetworkBadge = (network: string) => {
    const displayName = formatNetworkName(network)
    switch (network) {
      case 'MTN':
        return <Badge className="bg-yellow-50 text-yellow-600 border-0">{displayName}</Badge>
      case 'Vodafone':
        return <Badge className="bg-red-50 text-red-600 border-0">{displayName}</Badge>
      case 'AirtelTigo':
        return <Badge className="bg-emerald-50 text-emerald-600 border-0">{displayName}</Badge>
      case 'AT BIGTIME':
        return <Badge className="bg-emerald-50 text-emerald-600 border-0">{displayName}</Badge>
      case 'AT ISHARE':
        return <Badge className="bg-emerald-50 text-emerald-600 border-0">{displayName}</Badge>
      case 'TELECEL':
        return <Badge className="bg-red-50 text-red-600 border-0">{displayName}</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-500 border-0">{displayName}</Badge>
    }
  }

  const loadNetworks = async () => {
    try {
      const res = await fetch('/api/admin/networks', { cache: 'no-store' })
      
      if (!res.ok) {
        if (res.status === 401) {
          setNetworks([])
          return
        }
        // Fallback to public endpoint
        const pub = await fetch('/api/networks', { cache: 'no-store' })
        if (pub.ok) {
          const pubData = await pub.json().catch(() => null)
          if (pubData?.data) setNetworks(pubData.data)
        }
        return
      }
      
      const data = await res.json().catch(() => null)
      if (data?.data) {
        setNetworks(data.data)
      }
    } catch (error) {
      console.error('Error loading networks:', error)
      setNetworks([])
    }
  }

  const addNetwork = async () => {
    if (!newNetwork.trim()) {
      alert('Please enter a network name')
      return
    }
    setIsAddingNetwork(true)
    try {
      const res = await fetch('/api/admin/networks', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ name: newNetwork.trim() }) 
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const networkName = newNetwork.trim()
        setNewNetwork('')
        await loadNetworks()
        await checkNetworkSync()
        // Update newPlan network if it's empty
        if (!newPlan.network) {
          setNewPlan(prev => ({ ...prev, network: networkName }))
        }
      } else {
        alert(data.error || 'Failed to add network')
      }
    } catch (error) {
      console.error('Error adding network:', error)
      alert('Failed to add network')
    } finally {
      setIsAddingNetwork(false)
    }
  }

  const deleteNetwork = async (id: string) => {
    if (!confirm('Delete this network?')) return
    console.log('Attempting to delete network with id:', id)
    try {
      const res = await fetch(`/api/admin/networks/${id}`, { method: 'DELETE' })
      console.log('Delete response status:', res.status)
      if (res.ok) {
        console.log('Network deleted successfully')
        loadNetworks()
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Delete failed:', data)
        alert(data.error || 'Failed to delete network')
      }
    } catch (error) {
      console.error('Error deleting network:', error)
      alert('Failed to delete network')
    }
  }

  const startEditNetwork = (id: string, currentName: string) => {
    setEditingNetworkId(id)
    setEditingNetworkName(currentName)
  }

  const saveEditNetwork = async () => {
    if (!editingNetworkId) return
    const name = editingNetworkName.trim()
    if (!name) { alert('Name cannot be empty'); return }
    const res = await fetch(`/api/admin/networks/${editingNetworkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (res.ok) {
      setEditingNetworkId(null)
      setEditingNetworkName('')
      loadNetworks()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to update network')
    }
  }

  const filteredPlans = dataPlans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesNetwork = networkFilter === 'ALL' || plan.network === networkFilter
    const matchesStatus = statusFilter === 'ALL' || 
                         (statusFilter === 'ACTIVE' && plan.isActive) ||
                         (statusFilter === 'INACTIVE' && !plan.isActive)
    
    return matchesSearch && matchesNetwork && matchesStatus
  })

  // Sort filtered plans
  const sortedPlans = [...filteredPlans].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortBy) {
      case 'price':
        aValue = Number(getPlanPriceForRole(a, userRole))
        bValue = Number(getPlanPriceForRole(b, userRole))
        break
      case 'dataAmount':
        aValue = Number(a.dataAmount || 0)
        bValue = Number(b.dataAmount || 0)
        break
      case 'validity':
        aValue = Number(a.validity || 0)
        bValue = Number(b.validity || 0)
        break
      case 'network':
        aValue = a.network || ''
        bValue = b.network || ''
        break
      case 'name':
      default:
        aValue = a.name || ''
        bValue = b.name || ''
        break
    }

    // Handle numeric vs string comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    } else {
      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    }
  })

  // Group plans by network for better organization
  const plansByNetwork = sortedPlans.reduce((acc, plan) => {
    const network = plan.network
    if (!acc[network]) {
      acc[network] = []
    }
    acc[network].push(plan)
    return acc
  }, {} as Record<string, DataPlan[]>)

  const selectedNetworkPlans = networkFilter !== 'ALL' ? plansByNetwork[networkFilter] || [] : sortedPlans
  const selectedNetworkCount = networkFilter !== 'ALL' ? selectedNetworkPlans.length : sortedPlans.length

  const handleCreatePlan = async () => {
    // Validate required fields
    if (!newPlan.name.trim()) {
      alert('Please enter a plan name')
      return
    }
    if (!newPlan.network) {
      alert('Please select a network')
      return
    }
    if (newPlan.dataAmount <= 0) {
      alert('Please enter a valid data amount')
      return
    }
    if (newPlan.validity <= 0) {
      alert('Please enter a valid validity period')
      return
    }
    if (newPlan.priceCustomer <= 0 && newPlan.priceAgent <= 0 && newPlan.priceWholesaler <= 0 && newPlan.priceDealer <= 0) {
      alert('Please enter at least one role price')
      return
    }

    try {
      const response = await fetch('/api/admin/data-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan)
      })
      
      if (response.ok) {
        const data = await response.json()
        const plan = {
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          price: Number(data.data.price || 0),
          priceCustomer: Number(data.data.priceCustomer ?? data.data.price ?? 0),
          priceAgent: Number(data.data.priceAgent ?? 0),
          priceWholesaler: Number(data.data.priceWholesaler ?? 0),
          priceDealer: Number(data.data.priceDealer ?? 0),
          dataAmount: data.data.dataAmount,
          validity: data.data.validity,
          providerPlanId: data.data.providerPlanId ?? null,
          network: data.data.network || newPlan.network,
          isActive: data.data.isActive,
          createdAt: data.data.createdAt
        }
        setDataPlans(prev => [plan, ...prev])
        setPlanDrafts(prev => ({
          ...prev,
          [plan.id]: createPlanDraft(plan)
        }))
        setIsCreateDialogOpen(false)
        setNewPlan({
          name: '',
          description: '',
          providerPlanId: '',
          priceCustomer: 0,
          priceAgent: 0,
          priceWholesaler: 0,
          priceDealer: 0,
          dataAmount: 0,
          validity: 0,
          network: networks.length > 0 ? networks[0].name : '',
          isActive: true
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to create data plan')
      }
    } catch (error) {
      console.error('Error creating plan:', error)
      alert('Failed to create data plan')
    }
  }

  const handleEditPlan = (plan: DataPlan) => {
    setEditingPlan(plan)
    setIsEditDialogOpen(true)
  }

  const handleUpdatePlan = async () => {
    if (!editingPlan) return
    
    // Validate required fields
    if (!editingPlan.name.trim()) {
      alert('Please enter a plan name')
      return
    }
    if (!editingPlan.network) {
      alert('Please select a network')
      return
    }
    if (editingPlan.dataAmount <= 0) {
      alert('Please enter a valid data amount')
      return
    }
    if (editingPlan.validity <= 0) {
      alert('Please enter a valid validity period')
      return
    }
    if (editingPlan.priceCustomer <= 0 && editingPlan.priceAgent <= 0 && editingPlan.priceWholesaler <= 0 && editingPlan.priceDealer <= 0) {
      alert('Please enter at least one role price')
      return
    }
    
    try {
      const response = await fetch(`/api/admin/data-plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan)
      })
      
      if (response.ok) {
        const data = await response.json()
        const updatedPlan = {
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          price: Number(data.data.price || 0),
          priceCustomer: Number(data.data.priceCustomer ?? data.data.price ?? 0),
          priceAgent: Number(data.data.priceAgent ?? 0),
          priceWholesaler: Number(data.data.priceWholesaler ?? 0),
          priceDealer: Number(data.data.priceDealer ?? 0),
          dataAmount: data.data.dataAmount,
          validity: data.data.validity,
          providerPlanId: data.data.providerPlanId ?? null,
          network: data.data.network || editingPlan.network,
          isActive: data.data.isActive,
          createdAt: data.data.createdAt
        }
        
        setDataPlans(prev =>
          prev.map(plan => 
            plan.id === editingPlan.id ? updatedPlan : plan
          )
        )
        setPlanDrafts(prev => ({
          ...prev,
          [updatedPlan.id]: createPlanDraft(updatedPlan)
        }))
        setIsEditDialogOpen(false)
        setEditingPlan(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to update data plan')
      }
    } catch (error) {
      console.error('Error updating plan:', error)
      alert('Failed to update data plan')
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (confirm('Are you sure you want to delete this data plan?')) {
      try {
        const response = await fetch(`/api/admin/data-plans/${planId}`, { method: 'DELETE' })
        
        if (response.ok) {
          setDataPlans(prev => prev.filter(plan => plan.id !== planId))
          setPlanDrafts(prev => {
            const next = { ...prev }
            delete next[planId]
            return next
          })
        } else {
          const errorData = await response.json().catch(() => ({}))
          alert(errorData.error || 'Failed to delete data plan')
        }
      } catch (error) {
        console.error('Error deleting plan:', error)
        alert('Failed to delete data plan')
      }
    }
  }

  const handleTogglePlanStatus = async (planId: string) => {
    try {
      const plan = dataPlans.find(p => p.id === planId)
      if (!plan) return
      
      const response = await fetch(`/api/admin/data-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive })
      })
      
      if (response.ok) {
        setDataPlans(prev =>
          prev.map(p => 
            p.id === planId ? { ...p, isActive: !p.isActive } : p
          )
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to toggle plan status')
      }
    } catch (error) {
      console.error('Error toggling plan status:', error)
      alert('Failed to toggle plan status')
    }
  }

  const handleDeleteAllNetworks = async () => {
    if (!confirm('Are you sure you want to delete ALL networks? This will also delete all associated data plans. This action cannot be undone!')) {
      return
    }
    if (!confirm('This is your final warning. ALL networks and data plans will be permanently deleted. Continue?')) {
      return
    }
    try {
      const response = await fetch('/api/admin/networks', { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deletedCount} network(s)`)
        setNetworks([])
        setDataPlans([])
        loadNetworks()
        fetchDataPlans()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to delete all networks')
      }
    } catch (error) {
      console.error('Error deleting all networks:', error)
      alert('Failed to delete all networks')
    }
  }

  const handleDeleteAllDataPlans = async () => {
    if (!confirm(`Are you sure you want to delete ALL ${dataPlans.length} data plan(s)?\n\n⚠️ WARNING: This will also delete ALL orders associated with these plans. This action cannot be undone!`)) {
      return
    }
    if (!confirm('This is your final warning. ALL data plans and ALL orders will be permanently deleted. Continue?')) {
      return
    }
    try {
      const response = await fetch('/api/admin/data-plans', { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        const message = `Successfully deleted ${data.deletedCount} data plan(s)${data.deletedOrdersCount > 0 ? ` and ${data.deletedOrdersCount} order(s)` : ''}`
        alert(message)
        setDataPlans([])
        fetchDataPlans()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to delete all data plans')
      }
    } catch (error) {
      console.error('Error deleting all data plans:', error)
      alert('Failed to delete all data plans')
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Data Plans Management</h1>
              <p className="text-gray-500 text-sm sm:text-base">Manage available data bundles and role-based pricing</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="hidden sm:flex">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-gray-900 text-xl">Create New Data Plan</DialogTitle>
                <DialogDescription className="text-gray-500">
                  Add a new data bundle with role-based pricing
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-600">Plan Name *</Label>
                      <Input
                        id="name"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                        placeholder="e.g., MTN 1GB"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="network" className="text-gray-600">Network *</Label>
                      {networks.length === 0 ? (
                        <p className="text-sm text-red-600">No networks available. Please add a network first.</p>
                      ) : (
                        <Select value={newPlan.network || undefined} onValueChange={(value) => setNewPlan({...newPlan, network: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a network" />
                          </SelectTrigger>
                          <SelectContent>
                            {networks.map(network => (
                              <SelectItem key={network.id} value={network.name}>
                                {formatNetworkName(network.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataAmount" className="text-gray-600">Data Amount (MB) *</Label>
                      <Input
                        id="dataAmount"
                        type="number"
                        value={newPlan.dataAmount || ''}
                        onChange={(e) => setNewPlan({...newPlan, dataAmount: Number(e.target.value)})}
                        placeholder="1024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validity" className="text-gray-600">Validity (days) *</Label>
                      <Input
                        id="validity"
                        type="number"
                        value={newPlan.validity || ''}
                        onChange={(e) => setNewPlan({...newPlan, validity: Number(e.target.value)})}
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description" className="text-gray-600">Description</Label>
                      <Input
                        id="description"
                        value={newPlan.description}
                        onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                        placeholder="e.g., 1GB data valid for 30 days"
                      />
                    </div>
                    {/* <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="providerPlanId" className="text-gray-600">Provider plan id (DataDash GH)</Label>
                      <Input
                        id="providerPlanId"
                        value={newPlan.providerPlanId}
                        onChange={(e) => setNewPlan({...newPlan, providerPlanId: e.target.value})}
                        placeholder="e.g., 5f5d670197278900aa8c84855bbec91f"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500">Required for automatic fulfillment when the network uses DataDash. From the provider catalog: <code className="text-xs">plan_id</code>.</p>
                    </div> */}
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Role-Based Pricing</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Customer Price (₵) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPlan.priceCustomer || ''}
                        onChange={(e) => setNewPlan({...newPlan, priceCustomer: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Agent Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPlan.priceAgent || ''}
                        onChange={(e) => setNewPlan({...newPlan, priceAgent: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    {/* <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Wholesaler Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPlan.priceWholesaler || ''}
                        onChange={(e) => setNewPlan({...newPlan, priceWholesaler: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Dealer Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPlan.priceDealer || ''}
                        onChange={(e) => setNewPlan({...newPlan, priceDealer: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div> */}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlan}>
                  Create Plan
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-6">
        {/* Filters and Search */}
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-lg">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search plans by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Networks</SelectItem>
                    {networks.map(network => (
                      <SelectItem key={network.id} value={network.name}>
                        {formatNetworkName(network.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="dataAmount">Data Amount</SelectItem>
                    {/* <SelectItem value="validity">Validity</SelectItem> */}
                    <SelectItem value="network">Network</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-10 w-10"
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Plans List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-gray-900 text-xl sm:text-2xl font-bold">
                  Data Plans ({selectedNetworkCount})
                  {networkFilter !== 'ALL' && (
                    <span className="ml-2 text-base font-normal text-gray-500">
                      for {formatNetworkName(networkFilter)}
                    </span>
                  )}
                </h2>
                <p className="text-gray-500 mt-1 text-sm">Manage available data bundles and their pricing</p>
              </div>
              {networkFilter !== 'ALL' && (
                <Button 
                  variant="outline" 
                  onClick={() => setNetworkFilter('ALL')}
                  className="shrink-0"
                >
                  Show All Networks
                </Button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                  <p className="text-gray-500">Loading data plans...</p>
                </div>
              </div>
            ) : selectedNetworkPlans.length === 0 ? (
              <div className="text-center py-16">
                <Wifi className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {networkFilter !== 'ALL' 
                    ? `No data plans found for ${formatNetworkName(networkFilter)}`
                    : 'No data plans found'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {networkFilter !== 'ALL' 
                    ? 'Try selecting a different network or clear the filter.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
                <div className="flex gap-2 justify-center">
                  {networkFilter !== 'ALL' && (
                    <Button onClick={() => setNetworkFilter('ALL')} variant="outline">
                      Show All Networks
                    </Button>
                  )}
                  <Button onClick={() => { setSearchQuery(''); setNetworkFilter('ALL'); setStatusFilter('ALL') }} variant="outline">
                    Clear All Filters
                  </Button>
                </div>
              </div>
            ) : networkFilter !== 'ALL' ? (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
                  <NetworkGroupHeader
                    network={networkFilter}
                    plans={selectedNetworkPlans}
                    isSaving={!!savingNetworkMap[networkFilter]}
                    hasChanges={hasNetworkPriceChanges(selectedNetworkPlans)}
                    onSave={() => handleSaveNetworkPrices(networkFilter, selectedNetworkPlans)}
                    onReset={() => resetNetworkDrafts(selectedNetworkPlans)}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {selectedNetworkPlans.map(plan => renderPlanCard(plan))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(plansByNetwork).map(([network, plans]) => (
                  <div
                    key={network}
                    className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6"
                  >
                    <NetworkGroupHeader
                      network={network}
                      plans={plans}
                      isSaving={!!savingNetworkMap[network]}
                      hasChanges={hasNetworkPriceChanges(plans)}
                      onSave={() => handleSaveNetworkPrices(network, plans)}
                      onReset={() => resetNetworkDrafts(plans)}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {plans.map(plan => renderPlanCard(plan))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 text-xl">Edit Data Plan</DialogTitle>
              <DialogDescription className="text-gray-500">
                Update the data plan details and pricing
              </DialogDescription>
            </DialogHeader>
            {editingPlan && (
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name" className="text-gray-600">Plan Name *</Label>
                      <Input
                        id="edit-name"
                        value={editingPlan.name}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-network" className="text-gray-600">Network *</Label>
                      <Select value={editingPlan.network || undefined} onValueChange={(value) => editingPlan && setEditingPlan({...editingPlan, network: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a network" />
                        </SelectTrigger>
                        <SelectContent>
                          {networks.map(network => (
                            <SelectItem key={network.id} value={network.name}>
                              {formatNetworkName(network.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-dataAmount" className="text-gray-600">Data Amount (MB) *</Label>
                      <Input
                        id="edit-dataAmount"
                        type="number"
                        value={editingPlan.dataAmount}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, dataAmount: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-validity" className="text-gray-600">Validity (days) *</Label>
                      <Input
                        id="edit-validity"
                        type="number"
                        value={editingPlan.validity}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, validity: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="edit-description" className="text-gray-600">Description</Label>
                      <Input
                        id="edit-description"
                        value={editingPlan.description || ''}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, description: e.target.value})}
                      />
                    </div>
                    {/* <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="edit-providerPlanId" className="text-gray-600">Provider plan id (DataDash GH)</Label>
                      <Input
                        id="edit-providerPlanId"
                        value={editingPlan.providerPlanId ?? ''}
                        onChange={(e) => editingPlan && setEditingPlan({ ...editingPlan, providerPlanId: e.target.value || null })}
                        placeholder="e.g., 5f5d670197278900aa8c84855bbec91f"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500">Maps this bundle to the provider&apos;s <code className="text-xs">plan_id</code> (per network/size in their catalog).</p>
                    </div> */}
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Role-Based Pricing</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Customer Price (₵) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPlan.priceCustomer ?? 0}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, priceCustomer: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Agent Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPlan.priceAgent ?? 0}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, priceAgent: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    {/* <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Wholesaler Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPlan.priceWholesaler ?? 0}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, priceWholesaler: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Dealer Price (₵)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPlan.priceDealer ?? 0}
                        onChange={(e) => editingPlan && setEditingPlan({...editingPlan, priceDealer: Number(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div> */}
                  </div>
                  {/* Prices Preview */}
                  <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-white">
                    <div className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Price Summary</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Customer</span>
                        <span className="font-semibold text-gray-900">₵{Number(editingPlan.priceCustomer ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Agent</span>
                        <span className="font-semibold text-gray-900">₵{Number(editingPlan.priceAgent ?? 0).toFixed(2)}</span>
                      </div>
                      {/* <div className="flex items-center justify-between">
                        <span className="text-gray-500">Wholesaler</span>
                        <span className="font-semibold text-gray-900">₵{Number(editingPlan.priceWholesaler ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Dealer</span>
                        <span className="font-semibold text-gray-900">₵{Number(editingPlan.priceDealer ?? 0).toFixed(2)}</span>
                      </div> */}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePlan}>
                Update Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
