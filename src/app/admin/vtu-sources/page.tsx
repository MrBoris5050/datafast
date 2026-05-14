'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Server, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Key,
  Globe,
  Power,
  Star,
  Settings,
  Lock,
  CheckSquare
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNetworkName } from '@/lib/utils'

type VtuSource = {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKey: string
  isDefault: boolean
  active: boolean
}

type NetworkApiSetting = {
  id: string | null
  networkName: string
  vtuKey: string
  vtuSourceId: string | null
  isActive: boolean
  vtuSource: {
    id: string
    name: string
    provider: string
    active: boolean
  } | null
}

export default function AdminVtuSourcesPage() {
  const { data: session } = useSession()
  const [networkSettings, setNetworkSettings] = useState<NetworkApiSetting[]>([])
  const [vtuSources, setVtuSources] = useState<VtuSource[]>([])
  const [loading, setLoading] = useState(true)
  const [savingNetwork, setSavingNetwork] = useState<string | null>(null)
  
  // VTU Sources management
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [form, setForm] = useState({ 
    name: '', 
    provider: 'DATAHUBGH', 
    baseUrl: 'https://user.datahubgh.com/api', 
    apiKey: '', 
    isDefault: false, 
    active: true 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => { 
    loadData()
  }, [])
  
  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/network-api-settings', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.data) {
        setNetworkSettings(data.data)
        if (data.vtuSources) {
          setVtuSources(data.vtuSources)
        }
      } else {
        console.error('Failed to load network settings', { status: res.status, body: data })
      }
    } catch (e) {
      console.error('Error loading network settings', e)
    } finally { 
      setLoading(false) 
    }
    
    // Also load VTU sources separately
    try {
      const res = await fetch('/api/admin/vtu-sources', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.data) {
        setVtuSources(data.data)
      }
    } catch (e) {
      console.error('Error loading VTU sources', e)
    }
  }

  const saveNetworkSetting = async (networkName: string, setting: Partial<NetworkApiSetting>) => {
    setSavingNetwork(networkName)
    try {
      const res = await fetch('/api/admin/network-api-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkName,
          vtuKey: setting.vtuKey,
          vtuSourceId: setting.vtuSourceId || null,
          isActive: setting.isActive ?? true,
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to save network setting')
        return
      }
      loadData()
    } catch (error) {
      console.error('Error saving network setting:', error)
      alert('Failed to save network setting')
    } finally {
      setSavingNetwork(null)
    }
  }

  const updateNetworkSetting = (networkName: string, updates: Partial<NetworkApiSetting>) => {
    setNetworkSettings(prev => prev.map(s => 
      s.networkName === networkName ? { ...s, ...updates } : s
    ))
  }

  const createSource = async () => {
    if (!form.name.trim() || !form.baseUrl.trim() || !form.apiKey.trim()) {
      alert('Please fill in all required fields')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/vtu-sources', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { 
        alert(data.error || 'Failed to create source')
        return 
      }
      setForm({ name: '', provider: 'DATAHUBGH', baseUrl: 'https://user.datahubgh.com/api', apiKey: '', isDefault: false, active: true })
      setIsCreateDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Error creating source:', error)
      alert('Failed to create source')
    } finally {
      setIsSubmitting(false)
    }
  }

  const setDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/vtu-sources/${id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ isDefault: true }) 
      })
      if (res.ok) loadData()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to set default source')
      }
    } catch (error) {
      console.error('Error setting default:', error)
      alert('Failed to set default source')
    }
  }

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/vtu-sources/${id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ active: !active }) 
      })
      if (res.ok) loadData()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to toggle source status')
      }
    } catch (error) {
      console.error('Error toggling active:', error)
      alert('Failed to toggle source status')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this VTU source? This action cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/vtu-sources/${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadData()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete source')
      }
    } catch (error) {
      console.error('Error deleting source:', error)
      alert('Failed to delete source')
    }
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg">
              <Server className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">External API Order Management</h1>
              <p className="text-sm sm:text-base text-gray-400">Manage external API settings and monitor automated order processing</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Network API Settings Section */}
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Network API Settings
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure which networks use external API for order processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-400 mt-2">Loading network settings...</p>
                  </div>
                </div>
              ) : networkSettings.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No networks found</h3>
                  <p className="text-sm text-gray-400 mb-4">Networks will appear here once data plans are created.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {networkSettings.map((setting) => {
                    const isManual = !setting.vtuSourceId
                    const isSaving = savingNetwork === setting.networkName
                    const localSetting = networkSettings.find(s => s.networkName === setting.networkName) || setting
                    
                    return (
                      <Card key={setting.networkName} className="bg-gray-50 border-gray-200">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 text-lg mb-1">
                                {formatNetworkName(setting.networkName)}
                              </h3>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={setting.isActive 
                                    ? "bg-green-50 text-green-600 border-green-200" 
                                    : "bg-gray-500/20 text-gray-400 border-gray-200"
                                  }
                                >
                                  {setting.isActive ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Inactive
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-400 font-mono mb-3">
                                Key: {setting.vtuKey}
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            {isManual ? (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckSquare className="h-4 w-4 text-orange-600" />
                                  <span className="text-orange-600 text-sm font-medium">Manual Processing</span>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-400 mb-1 block">API Provider:</Label>
                                  <Select
                                    value={localSetting.vtuSourceId || 'manual'}
                                    onValueChange={(value) => {
                                      updateNetworkSetting(setting.networkName, { 
                                        vtuSourceId: value === 'manual' ? null : value
                                      })
                                    }}
                                  >
                                    <SelectTrigger className="bg-gray-100 border-gray-200 text-gray-900 h-9 text-sm">
                                      <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-100 border-gray-200">
                                      <SelectItem value="manual" className="text-gray-900 focus:bg-gray-100">
                                        Manual Processing
                                      </SelectItem>
                                      {vtuSources.filter(s => s.active).map((source) => (
                                        <SelectItem 
                                          key={source.id} 
                                          value={source.id}
                                          className="text-gray-900 focus:bg-gray-100"
                                        >
                                          {source.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <Lock className="h-4 w-4 text-purple-600" />
                                  <span className="text-purple-600 text-sm font-medium">API Enabled</span>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-400 mb-1 block">API Provider:</Label>
                                  <Select
                                    value={localSetting.vtuSourceId || 'manual'}
                                    onValueChange={(value) => {
                                      updateNetworkSetting(setting.networkName, { 
                                        vtuSourceId: value === 'manual' ? null : value
                                      })
                                    }}
                                  >
                                    <SelectTrigger className="bg-gray-100 border-gray-200 text-gray-900 h-9 text-sm">
                                      <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-100 border-gray-200">
                                      <SelectItem value="manual" className="text-gray-900 focus:bg-gray-100">
                                        Manual Processing
                                      </SelectItem>
                                      {vtuSources.filter(s => s.active).map((source) => (
                                        <SelectItem 
                                          key={source.id} 
                                          value={source.id}
                                          className="text-gray-900 focus:bg-gray-100"
                                        >
                                          {source.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={() => saveNetworkSetting(setting.networkName, localSetting)}
                            disabled={isSaving}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            {isSaving ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                              </>
                            ) : (
                              'Save Settings'
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* VTU Sources Management Section */}
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Server className="h-5 w-5" />
                VTU API Sources ({vtuSources.length})
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage VTU provider integrations and API configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Source
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] bg-gray-100 border-gray-200 text-gray-900 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Create VTU Source</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Enter the configuration details for the VTU provider
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="name" className="text-gray-900">Name</Label>
                        <Input 
                          id="name"
                          value={form.name} 
                          onChange={e => setForm({ ...form, name: e.target.value })} 
                          className="mt-1 bg-gray-100 border-gray-200 text-gray-900" 
                          placeholder="e.g., DataHubGH Production"
                        />
                      </div>
                      <div>
                        <Label htmlFor="provider" className="text-gray-900">Provider</Label>
                        <Input 
                          id="provider"
                          value={form.provider} 
                          onChange={e => setForm({ ...form, provider: e.target.value })} 
                          className="mt-1 bg-gray-100 border-gray-200 text-gray-900" 
                          placeholder="e.g., DATAHUBGH"
                        />
                      </div>
                      <div>
                        <Label htmlFor="baseUrl" className="text-gray-900">Base URL</Label>
                        <div className="relative mt-1">
                          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input 
                            id="baseUrl"
                            value={form.baseUrl} 
                            onChange={e => setForm({ ...form, baseUrl: e.target.value })} 
                            className="pl-10 bg-gray-100 border-gray-200 text-gray-900" 
                            placeholder="https://user.datahubgh.com/api"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="apiKey" className="text-gray-900">API Key</Label>
                        <div className="relative mt-1">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input 
                            id="apiKey"
                            type="password"
                            value={form.apiKey} 
                            onChange={e => setForm({ ...form, apiKey: e.target.value })} 
                            className="pl-10 bg-gray-100 border-gray-200 text-gray-900" 
                            placeholder="Enter your API key"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={form.isDefault} 
                            onChange={e => setForm({ ...form, isDefault: e.target.checked })} 
                            className="rounded border-gray-200"
                          />
                          Set as default source
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={form.active} 
                            onChange={e => setForm({ ...form, active: e.target.checked })} 
                            className="rounded border-gray-200"
                          />
                          Active
                        </label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        className="border-gray-200 text-gray-300 hover:bg-gray-100"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={createSource} 
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Source
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {vtuSources.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No VTU sources configured. Add one to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {vtuSources.map(s => (
                    <div 
                      key={s.id} 
                      className="p-4 sm:p-5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg">{s.name}</h3>
                            {s.isDefault && (
                              <Badge className="bg-yellow-50 text-yellow-600 border-yellow-200">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                            {s.active ? (
                              <Badge className="bg-green-50 text-green-600 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-600 border-red-200">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Server className="h-4 w-4" />
                              <span className="truncate">{s.provider}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Globe className="h-4 w-4" />
                              <span className="truncate text-xs">{s.baseUrl}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Key className="h-4 w-4" />
                              <span className="truncate text-xs font-mono">
                                {s.apiKey.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                        {!s.isDefault && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setDefault(s.id)} 
                            className="border-gray-200 text-gray-300 hover:bg-gray-100"
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Set Default
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => toggleActive(s.id, s.active)} 
                          className="border-gray-200 text-gray-300 hover:bg-gray-100"
                        >
                          {s.active ? (
                            <>
                              <Power className="h-3 w-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="h-3 w-3 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => remove(s.id)} 
                          className="border-gray-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
