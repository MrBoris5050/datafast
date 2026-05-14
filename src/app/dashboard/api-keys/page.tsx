'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Key, Webhook, BookOpen, Code, CheckCircle2, XCircle, AlertCircle, Copy, Eye, EyeOff, X, Clock, Calendar, Shield } from 'lucide-react'

interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  lastFour: string
  revoked: boolean
  createdAt: string
  lastUsedAt?: string | null
  raw?: string
  fullKey?: string | null
}

interface HookItem { 
  id: string
  url: string
  active: boolean
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [hooks, setHooks] = useState<HookItem[]>([])
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewingKey, setViewingKey] = useState<ApiKeyItem | null>(null)
  const [showViewKey, setShowViewKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  const loadKeys = async () => {
    setLoading(true)
    const res = await fetch('/api/developer/keys', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok) setKeys(data.data)
    setLoading(false)
  }

  const loadHooks = async () => {
    const res = await fetch('/api/developer/webhooks', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok) setHooks(data.data)
  }

  useEffect(() => {
    loadKeys()
    loadHooks()
  }, [])

  const createKey = async () => {
    setCreating(true)
    const res = await fetch('/api/developer/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'API Key' }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setNewlyCreatedKey(data.data.raw)
      setShowKey(true)
      setName('')
      loadKeys()
    } else {
      alert(data.error || 'Failed to create API key')
    }
  }

  const revoke = async (id: string) => {
    await fetch('/api/developer/keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'revoke' }) })
    loadKeys()
  }

  const createHook = async () => {
    const res = await fetch('/api/developer/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (res.ok) {
      alert(`Webhook secret (store safely): ${data.data.secret}`)
      setUrl('')
      loadHooks()
    } else {
      alert(data.error || 'Failed to create webhook')
    }
  }

  const toggle = async (id: string) => {
    await fetch('/api/developer/webhooks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle' }) })
    loadHooks()
  }

  const deleteHook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) return
    const res = await fetch('/api/developer/webhooks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) {
      loadHooks()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to delete webhook')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm text-gray-100 font-mono">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        className="absolute top-2 right-2 p-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        title="Copy to clipboard"
      >
        {copied === id ? (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  )

  return (
    // <DashboardLayout title="API & Developer Tools" subtitle="Manage API keys, webhooks, and documentation">
    <DashboardLayout title="API & Developer Tools">
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 border border-gray-200">
            <TabsTrigger value="keys" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 hover:text-gray-900">
              <Key className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">API Keys</span>
              <span className="sm:hidden">Keys</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 hover:text-gray-900">
              <Webhook className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Webhooks</span>
              <span className="sm:hidden">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 hover:text-gray-900">
              <BookOpen className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">API Docs</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Newly Created Key Display */}
            {newlyCreatedKey && (
              <Card className="bg-emerald-50 border-emerald-200 relative">
                <button
                  onClick={() => {
                    setNewlyCreatedKey(null)
                    setShowKey(false)
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-emerald-100 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
                <CardHeader className="p-4 sm:p-6 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-emerald-600 text-base sm:text-lg">API Key Created Successfully!</CardTitle>
                  </div>
                  <CardDescription className="text-emerald-700 text-sm mt-1">
                    Copy your API key now. For security reasons, you won&apos;t be able to see it again.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2">
                  <div className="bg-white border border-emerald-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <code className="flex-1 text-sm sm:text-base font-mono text-gray-900 break-all">
                        {showKey ? newlyCreatedKey : '•'.repeat(Math.min(newlyCreatedKey.length, 40))}
                      </code>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                          title={showKey ? 'Hide key' : 'Show key'}
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(newlyCreatedKey, 'new-key')}
                          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied === 'new-key' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-yellow-700">
                      Store this key securely. It will only be shown once. If you lose it, you&apos;ll need to create a new key.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-gray-900 text-base sm:text-lg">Create API Key</CardTitle>
                <CardDescription className="text-gray-500 text-sm">Keys are shown only once on creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                {keys.some(k => !k.revoked) ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      You already have an active API key. Please revoke your existing key before creating a new one.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="name" className="text-sm text-gray-700">Key Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-10 sm:h-11" placeholder="My Website" />
                    </div>
                    <Button onClick={createKey} disabled={creating} className="w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base">{creating ? 'Creating...' : 'Create Key'}</Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-gray-900 text-base sm:text-lg">Your API Keys</CardTitle>
                <CardDescription className="text-gray-500 text-sm">Use with Bearer authentication in the Authorization header</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                <div className="divide-y divide-gray-200">
                  {keys.map((k) => (
                      <div key={k.id} className="py-4 sm:py-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Key className="h-4 w-4 text-gray-500" />
                              <span className="font-semibold text-sm sm:text-base text-gray-900">{k.name}</span>
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-0 text-xs">Active</Badge>
                            </div>
                            <div className="ml-6 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Key:</span>
                                <code className="text-xs sm:text-sm text-gray-700 font-mono bg-gray-100 px-2 py-0.5 rounded break-all">
                                  {k.prefix}••••••••{k.lastFour}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(`${k.prefix}••••••••${k.lastFour}`, k.id)}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy masked key"
                                >
                                  {copied === k.id ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                                <span>Created: {new Date(k.createdAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}</span>
                                {k.lastUsedAt && (
                                  <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}</span>
                                )}
                              </div>
                            </div>
                      </div>
                          <div className="w-full sm:w-auto ml-6 sm:ml-0 flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 sm:flex-none border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-xs sm:text-sm h-9 sm:h-10" 
                              onClick={() => setViewingKey(k)}
                            >
                              <Eye className="h-4 w-4 mr-1.5" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs sm:text-sm h-9 sm:h-10" 
                              onClick={() => revoke(k.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                      </div>
                    </div>
                  ))}
                  {keys.length === 0 && (
                      <div className="text-center py-8 sm:py-12">
                        <Key className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-1">No API keys yet</p>
                        <p className="text-xs text-gray-400">Create your first API key to get started with the API</p>
                      </div>
                  )}
                </div>
                )}
              </CardContent>
            </Card>

            {/* View API Key Dialog */}
            <Dialog open={!!viewingKey} onOpenChange={(open) => { if (!open) { setViewingKey(null); setShowViewKey(false); } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-gray-900">
                    <Key className="h-5 w-5 text-blue-600" />
                    API Key Details
                  </DialogTitle>
                  <DialogDescription>
                    View information about your API key
                  </DialogDescription>
                </DialogHeader>
                {viewingKey && (
                  <div className="space-y-4 mt-2">
                    {/* Key Name */}
                    <div className="flex items-start gap-3 p-3 bg-gray-100 rounded-lg">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Key className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Key Name</p>
                        <p className="font-semibold text-gray-900">{viewingKey.name}</p>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Active</Badge>
                    </div>

                    {/* API Key */}
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-gray-500" />
                        <p className="text-xs text-gray-500">API Key</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-3">
                        <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                          {viewingKey.fullKey ? (
                            showViewKey ? viewingKey.fullKey : '•'.repeat(Math.min(viewingKey.fullKey.length, 40))
                          ) : (
                            `${viewingKey.prefix}••••••••${viewingKey.lastFour}`
                          )}
                        </code>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {viewingKey.fullKey && (
                            <button
                              onClick={() => setShowViewKey(!showViewKey)}
                              className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                              title={showViewKey ? 'Hide key' : 'Show key'}
                            >
                              {showViewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => copyToClipboard(viewingKey.fullKey || `${viewingKey.prefix}••••••••${viewingKey.lastFour}`, `view-${viewingKey.id}`)}
                            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                            title="Copy key"
                          >
                            {copied === `view-${viewingKey.id}` ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      {viewingKey.fullKey ? (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Full key available - click the eye icon to reveal
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Full key not available for older keys
                        </p>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-500" />
                          <p className="text-xs text-gray-500">Created</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(viewingKey.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(viewingKey.createdAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3.5 w-3.5 text-gray-500" />
                          <p className="text-xs text-gray-500">Last Used</p>
                        </div>
                        {viewingKey.lastUsedAt ? (
                          <>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(viewingKey.lastUsedAt).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(viewingKey.lastUsedAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400">Never used</p>
                        )}
                      </div>
                    </div>

                    {/* Usage Example */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-600 mb-2">Usage Example</p>
                      <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                        <code className="text-xs text-green-400 font-mono">
                          Authorization: Bearer YOUR_API_KEY
                        </code>
                      </div>
                    </div>

                    {/* Delete Button in Dialog */}
                    <Button 
                      variant="outline" 
                      className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" 
                      onClick={() => {
                        revoke(viewingKey.id)
                        setViewingKey(null)
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Delete This Key
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-gray-900 text-base sm:text-lg">Add Webhook</CardTitle>
                <CardDescription className="text-gray-500 text-sm">We will sign events with your secret</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                {hooks.length > 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      You can only have one webhook URL. Please update or delete your existing webhook first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="url" className="text-sm text-gray-700">Webhook URL</Label>
                      <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1.5 h-10 sm:h-11 text-sm sm:text-base" placeholder="https://example.com/webhooks/datafast" />
                    </div>
                    <Button onClick={createHook} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-10 sm:h-11 text-sm sm:text-base">Create Webhook</Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-gray-900 text-base sm:text-lg">Your Webhooks</CardTitle>
                <CardDescription className="text-gray-500 text-sm">Enable/disable as needed</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="divide-y divide-gray-200">
                  {hooks.map((h) => (
                    <div key={h.id} className="py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base text-gray-900 break-all">{h.url}</div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-1">{h.active ? 'Active' : 'Disabled'}</div>
                      </div>
                      <div className="w-full sm:w-auto flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggle(h.id)} className="w-full sm:w-auto border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 text-xs sm:text-sm h-9 sm:h-10">
                          {h.active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteHook(h.id)} className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs sm:text-sm h-9 sm:h-10">
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {hooks.length === 0 && (
                    <div className="text-sm text-gray-400 py-6 sm:py-8 text-center">No webhooks yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Docs Tab */}
          <TabsContent value="docs" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Base URL */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <Code className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Base URL</p>
                      <p className="text-base sm:text-lg font-mono text-gray-900 break-all">
                        {baseUrl || '\u00A0'}
                      </p>
                    </div>
                  </div>
                  {baseUrl && (
                    <button
                      onClick={() => copyToClipboard(baseUrl, 'base-url')}
                      className="p-2 rounded-md bg-white hover:bg-gray-50 border border-blue-200 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                      title="Copy base URL"
                    >
                      {copied === 'base-url' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Authentication Section */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Key className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900 text-base sm:text-lg">Authentication</CardTitle>
                    <CardDescription className="text-gray-500 text-sm">All API requests require authentication using an API key</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Include your API key in the Authorization header of every request:</p>
                  <CodeBlock
                    id="auth"
                    code={`Authorization: Bearer YOUR_API_KEY`}
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium mb-1">Security Note</p>
                      <p>Keep your API keys secure and never expose them in client-side code. Rotate keys regularly for better security.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create Purchase Endpoint */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Code className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">POST</Badge>
                        <CardTitle className="text-gray-900 text-base sm:text-lg">Create Purchase</CardTitle>
                      </div>
                      <CardDescription className="text-gray-500 text-sm">Purchase data bundle for a phone number</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-4 sm:p-6 pt-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Endpoint</p>
                  <CodeBlock
                    id="purchase-endpoint"
                    code={`POST /api/developer/purchase`}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Request Body</p>
                  <CodeBlock
                    id="purchase-request"
                    code={`{
  "network": "MTN",
  "Phone": "0541234567",
  "Datasize": 1,
  "reference": "optional-ref-123"
}`}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Request Parameters</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="text-left p-3 font-semibold text-gray-800">Parameter</th>
                          <th className="text-left p-3 font-semibold text-gray-800">Type</th>
                          <th className="text-left p-3 font-semibold text-gray-800">Required</th>
                          <th className="text-left p-3 font-semibold text-gray-800">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr className="border-b border-gray-200">
                          <td className="p-3 font-mono text-xs">network</td>
                          <td className="p-3">string</td>
                          <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Yes</Badge></td>
                          <td className="p-3">Network provider (MTN, AT ISHARE, TELECEL)</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="p-3 font-mono text-xs">Phone</td>
                          <td className="p-3">string</td>
                          <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Yes</Badge></td>
                          <td className="p-3">Phone number to purchase data for</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="p-3 font-mono text-xs">Datasize</td>
                          <td className="p-3">number</td>
                          <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Yes</Badge></td>
                          <td className="p-3">Data size in GB (e.g., 1 for 1GB)</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="p-3 font-mono text-xs">reference</td>
                          <td className="p-3">string</td>
                          <td className="p-3"><Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">No</Badge></td>
                          <td className="p-3">Optional custom reference for tracking</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Success Response (200)</p>
                  <CodeBlock
                    id="purchase-response"
                    code={`{
  "success": true,
  "data": {
    "order": {
      "reference": "api_abc123",
      "status": "PROCESSING",
      "amount": 10.50,
      "phone": "0541234567",
      "providerReference": "DH123456",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "plan": {
        "id": "plan_id",
        "name": "1GB Data",
        "dataAmountGB": "1.00",
        "network": "MTN"
      }
    },
    "currentBalance": 989.50,
    "message": "Order is being processed."
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Get Order Status Endpoint */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Code className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">GET</Badge>
                      <CardTitle className="text-gray-900 text-base sm:text-lg">Get Order Status</CardTitle>
                    </div>
                    <CardDescription className="text-gray-500 text-sm">Retrieve the status of an order by reference</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-4 sm:p-6 pt-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Endpoint</p>
                  <CodeBlock
                    id="status-endpoint"
                    code={`GET /api/developer/orders/{reference}`}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Success Response (200)</p>
                  <CodeBlock
                    id="status-response"
                    code={`{
  "success": true,
  "data": {
    "reference": "api_abc123",
    "status": "COMPLETED",
    "phone": "0541234567",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:05:00.000Z",
    "plan": {
      "dataAmountGB": "1GB",
      "network": "MTN"
    }
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Webhooks Section */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Webhook className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900 text-base sm:text-lg">Webhooks</CardTitle>
                    <CardDescription className="text-gray-500 text-sm">Receive real-time notifications about order status changes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    We will send webhook events to your configured URL when order status changes occur. 
                    Always verify webhook signatures using the shared secret for security.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Webhook Events</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">order.processing</span>
                        <p className="text-xs text-gray-500">Order has started processing</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">order.completed</span>
                        <p className="text-xs text-gray-500">Order has been successfully completed</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">order.failed</span>
                        <p className="text-xs text-gray-500">Order processing has failed</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-800 mb-2">Webhook Payload Example</p>
                  <CodeBlock
                    id="webhook-payload"
                    code={`{
  "event": "order.completed",
  "data": {
    "reference": "api_abc123",
    "status": "COMPLETED",
    "phone": "0541234567",
    "amount": 10.50
  },
  "timestamp": "2024-01-01T00:05:00.000Z"
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
