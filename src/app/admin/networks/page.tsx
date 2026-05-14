'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wifi,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Settings,
  Zap,
  AlertCircle,
  ShieldCheck,
  Network,
} from 'lucide-react'
import { formatNetworkName } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type NetworkRow = {
  id: string
  name: string
  isActive: boolean
  apiProvider: string | null
  apiKey: string | null
  baseUrl: string | null
  providerNetworkKey: string | null
}

const PROVIDERS = [
  { value: 'DATAHUBGH',  label: 'DataHubGH' },
  { value: 'DATADASHGH', label: 'DataDash GH (agents API)' },
  { value: 'DATAWAVEGH', label: 'Data Wave (dealers.datawavegh.com)' },
  { value: 'HUBNETGH',   label: 'Hubnet (console.hubnet.app)' },
  { value: 'MANUAL',     label: 'Manual (admin processes)' },
]

const PROVIDER_KEYS: Record<string, { value: string; label: string }[]> = {
  DATAHUBGH: [
    { value: 'YELLO',      label: 'MTN — YELLO' },
    { value: 'AT_PREMIUM', label: 'AirtelTigo / AT iShare — AT_PREMIUM' },
    { value: 'AT_BIGTIME', label: 'AirtelTigo Bigtime — AT_BIGTIME' },
    { value: 'TELECEL',    label: 'Telecel (Vodafone) — TELECEL' },
  ],
  DATADASHGH: [
    { value: 'AIRTEL-TIGO', label: 'AirtelTigo — AIRTEL-TIGO (iShare / catalog)' },
    { value: 'MTN',         label: 'MTN — MTN' },
    { value: 'TELECEL',     label: 'Telecel — TELECEL' },
  ],
  DATAWAVEGH: [
    { value: 'mtn',      label: 'MTN — mtn' },
    { value: 'telecel',  label: 'Telecel — telecel' },
    { value: 'ishare',   label: 'AirtelTigo ISHARE — iShare' },
    { value: 'bigtime',  label: 'AirtelTigo BIGTIME — bigtime' },
  ],
  HUBNETGH: [
    { value: 'mtn',      label: 'MTN — mtn' },
    { value: 'at',       label: 'AirtelTigo — at' },
    { value: 'big-time', label: 'AirtelTigo Big Time — big-time' },
  ],
}

export default function AdminNetworksPage() {
  const { toast } = useToast()
  const [networks, setNetworks]     = useState<NetworkRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [newNetwork, setNewNetwork] = useState('')
  const [isAdding, setIsAdding]     = useState(false)

  // Rename inline
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Provider config dialog
  const [configTarget, setConfigTarget] = useState<NetworkRow | null>(null)
  const [configForm, setConfigForm] = useState({
    apiProvider: '',
    providerNetworkKey: '',
  })
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/networks', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (Array.isArray(data?.data)) setNetworks(data.data)
    } catch {
      toast({ title: 'Failed to load networks', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Add ──────────────────────────────────────────────────────────────────────
  const add = async () => {
    if (!newNetwork.trim()) return
    setIsAdding(true)
    try {
      const res = await fetch('/api/admin/networks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newNetwork.trim() }),
      })
      if (res.ok) { setNewNetwork(''); load() }
      else {
        const d = await res.json().catch(() => ({}))
        toast({ title: d.error || 'Failed to add network', variant: 'destructive' })
      }
    } finally { setIsAdding(false) }
  }

  // ── Rename ───────────────────────────────────────────────────────────────────
  const saveRename = async () => {
    if (!editingId || !editingName.trim()) return
    const res = await fetch(`/api/admin/networks/${editingId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editingName.trim() }),
    })
    if (res.ok) { setEditingId(null); load() }
    else toast({ title: 'Failed to rename', variant: 'destructive' })
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    if (!confirm('Delete this network? This cannot be undone.')) return
    const res = await fetch(`/api/admin/networks/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else toast({ title: 'Failed to delete network', variant: 'destructive' })
  }

  // ── Open provider config dialog ───────────────────────────────────────────────
  const openConfig = (n: NetworkRow) => {
    setConfigTarget(n)
    setConfigForm({
      apiProvider:        n.apiProvider        ?? '',
      providerNetworkKey: n.providerNetworkKey ?? '',
    })
  }

  // ── Save provider config ──────────────────────────────────────────────────────
  const saveConfig = async () => {
    if (!configTarget) return
    setIsSavingConfig(true)
    try {
      const res = await fetch(`/api/admin/networks/${configTarget.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiProvider:        configForm.apiProvider        || null,
          providerNetworkKey: configForm.providerNetworkKey || null,
        }),
      })
      if (res.ok) {
        toast({ title: `${configTarget.name} provider config saved` })
        setConfigTarget(null)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        toast({ title: d.error || 'Failed to save config', variant: 'destructive' })
      }
    } finally { setIsSavingConfig(false) }
  }

  const providerKeys = PROVIDER_KEYS[configForm.apiProvider] ?? []

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg">
              <Network className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Networks</h1>
              <p className="text-sm sm:text-base text-gray-400">
                Manage networks and their provider config for automatic fulfillment
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Add network */}
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Network
              </CardTitle>
              <CardDescription className="text-gray-400">
                Add a new network — then configure its provider below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={newNetwork}
                  onChange={(e) => setNewNetwork(e.target.value)}
                  placeholder="e.g., MTN, AT ISHARE, Telecel"
                  className="flex-1 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-500"
                  onKeyDown={(e) => e.key === 'Enter' && !isAdding && add()}
                  disabled={isAdding}
                />
                <Button
                  onClick={add}
                  disabled={isAdding || !newNetwork.trim()}
                  className="bg-blue-600 hover:bg-blue-700 shrink-0"
                >
                  {isAdding ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Adding...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" />Add Network</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Network list */}
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Networks ({networks.length})
              </CardTitle>
              <CardDescription className="text-gray-400">
                Set each network's provider so orders are fulfilled automatically
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : networks.length === 0 ? (
                <div className="text-center py-12">
                  <Wifi className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                  <p className="text-gray-400">No networks yet. Add one above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {networks.map((n) => {
                    const isAuto = !!n.apiProvider && n.apiProvider !== 'MANUAL'
                    return (
                      <div
                        key={n.id}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all space-y-3"
                      >
                        {/* Name row */}
                        {editingId === n.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="bg-gray-100 border-gray-200 text-gray-900"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  saveRename()
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveRename} className="flex-1 bg-blue-600 hover:bg-blue-700">
                                <Check className="h-3 w-3 mr-1" />Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1 border-gray-200 text-gray-300">
                                <X className="h-3 w-3 mr-1" />Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 rounded-lg">
                                  <Network className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="font-semibold text-gray-900">{formatNetworkName(n.name)}</span>
                              </div>
                              {isAuto ? (
                                <Badge className="bg-green-50 text-green-600 border-green-200 text-xs">
                                  <Zap className="h-3 w-3 mr-1" />Auto
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-50 text-yellow-600 border-yellow-200 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />Manual
                                </Badge>
                              )}
                            </div>

                            {/* Provider summary */}
                            <div className="text-xs text-gray-400 space-y-0.5 bg-gray-100 rounded p-2">
                              <div className="flex justify-between">
                                <span>Provider</span>
                                <span className="text-gray-300">{n.apiProvider ?? '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Network key</span>
                                <span className="text-gray-300">{n.providerNetworkKey ?? '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Credentials</span>
                                <span className="text-green-600 flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3" />from env
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => openConfig(n)}
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
                                variant="outline"
                              >
                                <Settings className="h-3 w-3 mr-1" />Configure
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingId(n.id); setEditingName(n.name) }}
                                className="border-gray-200 text-gray-300 hover:bg-gray-100"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => remove(n.id)}
                                className="border-gray-200 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Provider config dialog ── */}
      <Dialog open={!!configTarget} onOpenChange={(open) => { if (!open) setConfigTarget(null) }}>
        <DialogContent className="bg-gray-100 border-gray-200 text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Configure — {configTarget && formatNetworkName(configTarget.name)}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Set the provider and credentials used to fulfill orders for this network automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Provider */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Provider</Label>
              <Select
                value={configForm.apiProvider}
                onValueChange={(v) => setConfigForm(f => ({ ...f, apiProvider: v, providerNetworkKey: '' }))}
              >
                <SelectTrigger className="bg-gray-100 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select provider…" />
                </SelectTrigger>
                <SelectContent className="bg-gray-100 border-gray-200">
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-gray-900 focus:bg-gray-100">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {configForm.apiProvider && configForm.apiProvider !== 'MANUAL' && (
              <>
                {/* Network key */}
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Network Key</Label>
                  {providerKeys.length > 0 ? (
                    <Select
                      value={configForm.providerNetworkKey}
                      onValueChange={(v) => setConfigForm(f => ({ ...f, providerNetworkKey: v }))}
                    >
                      <SelectTrigger className="bg-gray-100 border-gray-200 text-gray-900">
                        <SelectValue placeholder="Select network key…" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-100 border-gray-200">
                        {providerKeys.map(k => (
                          <SelectItem key={k.value} value={k.value} className="text-gray-900 focus:bg-gray-100">
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={configForm.providerNetworkKey}
                      onChange={(e) => setConfigForm(f => ({ ...f, providerNetworkKey: e.target.value }))}
                      placeholder="e.g., YELLO"
                      className="bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-500"
                    />
                  )}
                    <p className="text-xs text-gray-500">
                  {configForm.apiProvider === 'DATADASHGH'
                      ? 'Catalog label (DataDash uses per-plan ids on each data plan).'
                      : configForm.apiProvider === 'DATAWAVEGH'
                        ? 'ishare and bigtime map to AirtelTigo ISHARE and AirtelTigo BIGTIME; mtn and telecel are sent as-is. Package size is plan GB.'
                        : configForm.apiProvider === 'HUBNETGH'
                          ? 'Network key sent in the Hubnet endpoint URL: mtn, at, or big-time.'
                          : 'The key this provider uses to identify this network.'}
                  </p>
                </div>

                {/* Credentials from env — read-only indicator */}
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-600 space-y-0.5">
                    <p className="font-medium">Credentials loaded from environment</p>
                    <p className="text-green-600/70 text-xs">
                      {configForm.apiProvider === 'DATADASHGH' ? (
                        <>
                          API key and base URL are read from{' '}
                          <code className="bg-green-900/40 px-1 rounded">DATADASHGH_API_KEY</code> and{' '}
                          <code className="bg-green-900/40 px-1 rounded">DATADASHGH_BASE_URL</code> (default{' '}
                          <code className="bg-green-900/40 px-1 rounded">https://datadashgh.com/agents/api/v1</code>
                          ). Set each bundle&apos;s <code className="bg-green-900/40 px-1 rounded">plan_id</code> under Data Plans.
                        </>
                      ) : configForm.apiProvider === 'DATAWAVEGH' ? (
                        <>
                          Set <code className="bg-green-900/40 px-1 rounded">DATAWAVEGH_API_KEY</code> to{' '}
                          <code className="bg-green-900/40 px-1 rounded">username:application_password</code> (WordPress profile → Application Passwords; not your login password unless the site allows it). Spaces in the app password are stripped automatically. Optional{' '}
                          <code className="bg-green-900/40 px-1 rounded">DATAWAVEGH_BASE_URL</code> (default{' '}
                          <code className="bg-green-900/40 px-1 rounded">https://dealers.datawavegh.com/wp-json/custom/v1</code>).
                        </>
                      ) : configForm.apiProvider === 'HUBNETGH' ? (
                        <>
                          Set <code className="bg-green-900/40 px-1 rounded">HUBNETGH_API_KEY</code> to your Hubnet Bearer token. Optional{' '}
                          <code className="bg-green-900/40 px-1 rounded">HUBNETGH_BASE_URL</code> (default{' '}
                          <code className="bg-green-900/40 px-1 rounded">https://console.hubnet.app/live/api/context/business/transaction</code>
                          ). Volume is sent in MB; reference is trimmed to 25 characters.
                        </>
                      ) : (
                        <>
                          API key and base URL are read from <code className="bg-green-900/40 px-1 rounded">DATAHUBGH_API_KEY</code> and{' '}
                          <code className="bg-green-900/40 px-1 rounded">DATAHUBGH_BASE_URL</code> — no manual entry needed.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}

            {configForm.apiProvider === 'MANUAL' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-600">
                  Orders for this network will go to the admin queue for manual processing.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfigTarget(null)}
              className="border-gray-200 text-gray-300 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={saveConfig}
              disabled={isSavingConfig}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSavingConfig ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Saving…</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Save Config</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
