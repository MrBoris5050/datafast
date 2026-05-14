'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface HookItem { id: string; url: string; active: boolean; createdAt: string }

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<HookItem[]>([])
  const [url, setUrl] = useState('')

  const load = async () => {
    const res = await fetch('/api/developer/webhooks', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok) setHooks(data.data)
  }

  useEffect(() => { load() }, [])

  const createHook = async () => {
    const res = await fetch('/api/developer/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (res.ok) {
      alert(`Webhook secret (store safely): ${data.data.secret}`)
      setUrl('')
      load()
    } else {
      alert(data.error || 'Failed to create webhook')
    }
  }

  const toggle = async (id: string) => {
    await fetch('/api/developer/webhooks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle' }) })
    load()
  }

  const deleteHook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) return
    const res = await fetch('/api/developer/webhooks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) {
      load()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to delete webhook')
    }
  }

  return (
    <DashboardLayout title="Webhooks">
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        <Card className="bg-white border-gray-200 text-gray-900">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-gray-900 text-base sm:text-lg">Add Webhook</CardTitle>
            <CardDescription className="text-gray-600 text-sm">We will sign events with your secret</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
            {hooks.length > 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  You can only have one webhook URL. Please update or delete your existing webhook first.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="url" className="text-sm text-gray-700">Webhook URL</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1.5 bg-white border-gray-300 text-gray-900 h-10 sm:h-11 text-sm sm:text-base" placeholder="https://example.com/webhooks/datafast" />
                </div>
                <Button onClick={createHook} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-10 sm:h-11 text-sm sm:text-base">Create Webhook</Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 text-gray-900">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-gray-900 text-base sm:text-lg">Your Webhooks</CardTitle>
            <CardDescription className="text-gray-600 text-sm">Enable/disable as needed</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="divide-y divide-gray-200">
              {hooks.map((h) => (
                <div key={h.id} className="py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm sm:text-base text-gray-900 break-all">{h.url}</div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">{h.active ? 'Active' : 'Disabled'}</div>
                  </div>
                  <div className="w-full sm:w-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggle(h.id)} className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm h-9 sm:h-10">
                      {h.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteHook(h.id)} className="w-full sm:w-auto border-red-300 text-red-700 hover:bg-red-50 text-xs sm:text-sm h-9 sm:h-10">
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {hooks.length === 0 && (
                <div className="text-sm text-gray-500 py-6 sm:py-8 text-center">No webhooks yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}


