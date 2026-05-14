'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Download, Upload, Eye, Trash2, Edit } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Voucher {
  id: string
  code: string
  pin?: string
  serial?: string
  type: 'BECE' | 'WASSCE'
  price: number
  isUsed: boolean
  isActive: boolean
  isSold: boolean
  userId?: string
  user?: {
    name: string
    email: string
  }
  usedAt?: string
  expiresAt?: string
  createdAt: string
}

interface VoucherStats {
  total: number
  active: number
  used: number
  unused: number
  beceCount: number
  wassceCount: number
  totalValue: number
}

export default function AdminVouchersPage() {
  const { toast } = useToast()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    active: 0,
    used: 0,
    unused: 0,
    beceCount: 0,
    wassceCount: 0,
    totalValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isBulkCreateDialogOpen, setIsBulkCreateDialogOpen] = useState(false)
  const [isSingleUploadDialogOpen, setIsSingleUploadDialogOpen] = useState(false)
  const [isCsvUploadDialogOpen, setIsCsvUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set())
  const [processingBulkAction, setProcessingBulkAction] = useState(false)
  const [voucherPricing, setVoucherPricing] = useState<{ type: string; price: number }[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)
  const [editingPricing, setEditingPricing] = useState<{ type: string; price: string } | null>(null)

  // Create voucher form state
  const [createForm, setCreateForm] = useState({
    type: 'BECE' as 'BECE' | 'WASSCE',
    pin: '',
    serial: '',
    expiresAt: ''
  })

  // Bulk create form state
  const [bulkForm, setBulkForm] = useState({
    type: 'BECE' as 'BECE' | 'WASSCE',
    vouchers: '' // Format: PIN,Serial (one per line)
  })

  // Single voucher upload form state
  const [singleUploadForm, setSingleUploadForm] = useState({
    type: 'BECE' as 'BECE' | 'WASSCE',
    pin: '',
    serial: '',
    code: '',
    expiresAt: ''
  })

  // CSV upload form state
  const [csvUploadForm, setCsvUploadForm] = useState({
    type: 'BECE' as 'BECE' | 'WASSCE',
    file: null as File | null
  })

  useEffect(() => {
    fetchVouchers()
    fetchVoucherPricing()
  }, [])

  const fetchVoucherPricing = async () => {
    try {
      setPricingLoading(true)
      const response = await fetch('/api/admin/vouchers/pricing')
      if (response.ok) {
        const data = await response.json()
        setVoucherPricing(data.pricing)
      }
    } catch (error) {
      console.error('Error fetching voucher pricing:', error)
    } finally {
      setPricingLoading(false)
    }
  }

  const handleUpdatePricing = async (type: string, price: string) => {
    try {
      setPricingLoading(true)
      const response = await fetch('/api/admin/vouchers/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, price })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message
        })
        setEditingPricing(null)
        fetchVoucherPricing()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to update pricing',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error updating pricing",
        variant: "destructive"
      })
    } finally {
      setPricingLoading(false)
    }
  }

  const fetchVouchers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/vouchers')
      if (response.ok) {
        const data = await response.json()
        setVouchers(data.vouchers)
        setStats(data.stats)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch vouchers",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error fetching vouchers",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVoucher = async () => {
    if (!createForm.pin || !createForm.serial) {
      toast({
        title: "Error",
        description: "PIN and Serial are required",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createForm.type,
          pin: createForm.pin,
          serial: createForm.serial,
          expiresAt: createForm.expiresAt || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || `${createForm.type} voucher created successfully`
        })
        setIsCreateDialogOpen(false)
        setCreateForm({ type: 'BECE', pin: '', serial: '', expiresAt: '' })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to create voucher',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error creating voucher",
        variant: "destructive"
      })
    }
  }

  const handleSingleUpload = async () => {
    if (!singleUploadForm.pin || !singleUploadForm.serial) {
      toast({
        title: "Error",
        description: "PIN and Serial are required",
        variant: "destructive"
      })
      return
    }

    try {
      setUploading(true)
      const response = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: singleUploadForm.type,
          pin: singleUploadForm.pin,
          serial: singleUploadForm.serial,
          code: singleUploadForm.code || null,
          expiresAt: singleUploadForm.expiresAt || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || 'Voucher uploaded successfully'
        })
        setIsSingleUploadDialogOpen(false)
        setSingleUploadForm({ type: 'BECE', pin: '', serial: '', code: '', expiresAt: '' })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to upload voucher',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error uploading voucher",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleCsvUpload = async () => {
    if (!csvUploadForm.file) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive"
      })
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', csvUploadForm.file)
      formData.append('type', csvUploadForm.type)

      const response = await fetch('/api/admin/vouchers/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || `Successfully uploaded ${data.created} voucher(s)`
        })
        if (data.errors && data.errors.length > 0) {
          console.warn('Upload errors:', data.errors)
        }
        if (data.duplicates && data.duplicates.length > 0) {
          console.warn('Duplicates:', data.duplicates)
        }
        setIsCsvUploadDialogOpen(false)
        setCsvUploadForm({ type: 'BECE', file: null })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to upload vouchers',
          variant: "destructive"
        })
        if (data.errors) {
          console.error('Upload errors:', data.errors)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error uploading vouchers",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleBulkCreate = async () => {
    if (!bulkForm.vouchers.trim()) {
      toast({
        title: "Error",
        description: "Please enter voucher details",
        variant: "destructive"
      })
      return
    }

    // Parse the vouchers textarea (format: PIN Serial or PIN\tSerial one per line)
    const lines = bulkForm.vouchers.split('\n').filter(line => line.trim())
    const vouchers = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Try tab separator first, then space(s), then comma as fallback
      let parts: string[] = []
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim())
      } else {
        // Split by whitespace (space, multiple spaces, or tabs)
        parts = line.split(/\s+/).map(p => p.trim())
      }
      
      if (parts.length < 2) {
        toast({
          title: "Error",
          description: `Line ${i + 1}: Invalid format. Expected: PIN Serial or PIN\tSerial`,
          variant: "destructive"
        })
        return
      }

      vouchers.push({
        pin: parts[0],
        serial: parts[1]
      })
    }

    if (vouchers.length === 0) {
      toast({
        title: "Error",
        description: "No valid vouchers found",
        variant: "destructive"
      })
      return
    }

    try {
      // Create vouchers one by one (or in batch)
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const voucher of vouchers) {
        try {
          const response = await fetch('/api/admin/vouchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: bulkForm.type,
              pin: voucher.pin,
              serial: voucher.serial
            })
          })

          const data = await response.json()

          if (response.ok) {
            successCount++
          } else {
            errorCount++
            errors.push(`${voucher.pin}/${voucher.serial}: ${data.error || 'Failed'}`)
          }
        } catch (error) {
          errorCount++
          errors.push(`${voucher.pin}/${voucher.serial}: Error`)
        }
      }

      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} voucher(s) created successfully${errorCount > 0 ? `. ${errorCount} failed.` : ''}`
        })
        if (errors.length > 0) {
          console.error('Bulk create errors:', errors)
        }
        setIsBulkCreateDialogOpen(false)
        setBulkForm({ type: 'BECE', vouchers: '' })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: `Failed to create vouchers. ${errors.join('; ')}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error creating vouchers",
        variant: "destructive"
      })
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/vouchers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Voucher ${!isActive ? 'activated' : 'deactivated'}`
        })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: "Failed to update voucher",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error updating voucher",
        variant: "destructive"
      })
    }
  }

  const handleDeleteVoucher = async (id: string) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return

    try {
      const response = await fetch(`/api/admin/vouchers/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Voucher deleted successfully"
        })
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: "Failed to delete voucher",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error deleting voucher",
        variant: "destructive"
      })
    }
  }

  const downloadSampleCsv = () => {
    const sampleData = [
      ['pin', 'serial', 'code'],
      ['1234567890', 'ABC123456', 'BC2024123456'],
      ['9876543210', 'XYZ987654', 'WS2024987654'],
      ['5555555555', 'DEF555555', 'BC2024555555']
    ]

    const csvContent = sampleData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voucher-sample.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    toast({
      title: "Success",
      description: "Sample CSV file downloaded"
    })
  }

  const toggleVoucherSelection = (voucherId: string) => {
    setSelectedVouchers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(voucherId)) {
        newSet.delete(voucherId)
      } else {
        newSet.add(voucherId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedVouchers.size === filteredVouchers.length) {
      setSelectedVouchers(new Set())
    } else {
      setSelectedVouchers(new Set(filteredVouchers.map(v => v.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedVouchers.size === 0) {
      toast({
        title: "Error",
        description: "Please select vouchers to delete",
        variant: "destructive"
      })
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedVouchers.size} voucher(s)?`)) return

    try {
      setProcessingBulkAction(true)
      const response = await fetch('/api/admin/vouchers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers)
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || `${selectedVouchers.size} voucher(s) deleted successfully`
        })
        setSelectedVouchers(new Set())
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to delete vouchers',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error deleting vouchers",
        variant: "destructive"
      })
    } finally {
      setProcessingBulkAction(false)
    }
  }

  const handleBulkMarkAsSold = async () => {
    if (selectedVouchers.size === 0) {
      toast({
        title: "Error",
        description: "Please select vouchers to mark as sold",
        variant: "destructive"
      })
      return
    }

    try {
      setProcessingBulkAction(true)
      const response = await fetch('/api/admin/vouchers/bulk-mark-sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          isSold: true
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || `${selectedVouchers.size} voucher(s) marked as sold`
        })
        setSelectedVouchers(new Set())
        fetchVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to mark vouchers as sold',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error marking vouchers as sold",
        variant: "destructive"
      })
    } finally {
      setProcessingBulkAction(false)
    }
  }

  const exportVouchers = async () => {
    try {
      const response = await fetch('/api/admin/vouchers/export')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vouchers-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({
          title: "Success",
          description: "Vouchers exported successfully"
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to export vouchers",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error exporting vouchers",
        variant: "destructive"
      })
    }
  }

  const filteredVouchers = vouchers.filter(voucher => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = voucher.code.toLowerCase().includes(searchLower) ||
                         voucher.pin?.toLowerCase().includes(searchLower) ||
                         voucher.serial?.toLowerCase().includes(searchLower) ||
                         voucher.user?.name?.toLowerCase().includes(searchLower) ||
                         voucher.user?.email?.toLowerCase().includes(searchLower)
    
    const matchesType = filterType === 'all' || voucher.type === filterType
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'used' && voucher.isUsed) ||
                         (filterStatus === 'unused' && !voucher.isUsed) ||
                         (filterStatus === 'active' && voucher.isActive) ||
                         (filterStatus === 'inactive' && !voucher.isActive) ||
                         (filterStatus === 'sold' && voucher.isSold)
    
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Voucher Management</h1>
          <p className="text-gray-400 mt-1">Manage BECE and WASSCE result checker vouchers</p>
        </div>

        {/* Voucher Pricing Management */}
        <Card className="bg-gray-100 border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Voucher Pricing</CardTitle>
            <CardDescription className="text-gray-400">
              Set default prices for BECE and WASSCE vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pricingLoading ? (
              <div className="text-center py-4 text-gray-400">Loading pricing...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(voucherPricing.length > 0 ? voucherPricing : [
                  { type: 'BECE', price: 5.00 },
                  { type: 'WASSCE', price: 10.00 }
                ]).map((pricing) => (
                  <div key={pricing.type} className="bg-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{pricing.type} Voucher</h3>
                        <p className="text-sm text-gray-400">Default price for {pricing.type} vouchers</p>
                      </div>
                      <Badge variant={pricing.type === 'BECE' ? 'default' : 'secondary'}>
                        {pricing.type}
                      </Badge>
                    </div>
                    
                    {editingPricing?.type === pricing.type ? (
                      <div className="space-y-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={editingPricing.price}
                          onChange={(e) => setEditingPricing(prev => prev ? { ...prev, price: e.target.value } : null)}
                          className="bg-gray-100 border-gray-300"
                          placeholder="Enter price"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdatePricing(pricing.type, editingPricing.price)}
                            disabled={pricingLoading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPricing(null)}
                            className="border-gray-200"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">₵{Number(pricing.price).toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-1">Current price</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPricing({ type: pricing.type, price: pricing.price.toString() })}
                          className="border-gray-200"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Active Vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Used Vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.used}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-100 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">₵{stats.totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Actions and Filters */}
        <Card className="bg-gray-100 border-gray-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-gray-900">Vouchers</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage BECE and WASSCE result checker vouchers
                </CardDescription>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Voucher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-100 border-gray-200 text-gray-900">
                    <DialogHeader>
                      <DialogTitle>Create New Voucher</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Create a voucher with PIN and Serial for BECE or WASSCE results checking
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="type">Voucher Type</Label>
                        <Select value={createForm.type} onValueChange={(value: 'BECE' | 'WASSCE') => 
                          setCreateForm(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger className="bg-gray-100 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-100 border-gray-200">
                            <SelectItem value="BECE">BECE</SelectItem>
                            <SelectItem value="WASSCE">WASSCE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="pin">PIN *</Label>
                        <Input
                          id="pin"
                          value={createForm.pin}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, pin: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                          placeholder="Enter PIN"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="serial">Serial *</Label>
                        <Input
                          id="serial"
                          value={createForm.serial}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, serial: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                          placeholder="Enter Serial"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
                        <Input
                          id="expiresAt"
                          type="datetime-local"
                          value={createForm.expiresAt}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateVoucher} className="bg-blue-600 hover:bg-blue-700">
                        Create Voucher
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isBulkCreateDialogOpen} onOpenChange={setIsBulkCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-gray-200 text-black hover:bg-gray-100">
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-100 border-gray-200 text-gray-900">
                    <DialogHeader>
                      <DialogTitle>Bulk Create Vouchers</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Create multiple vouchers with PIN and Serial. Enter one voucher per line separated by space or tab: PIN Serial
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bulk-type">Voucher Type</Label>
                        <Select value={bulkForm.type} onValueChange={(value: 'BECE' | 'WASSCE') => 
                          setBulkForm(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger className="bg-gray-100 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-100 border-gray-200">
                            <SelectItem value="BECE">BECE</SelectItem>
                            <SelectItem value="WASSCE">WASSCE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="bulk-vouchers">Vouchers (PIN,Serial) *</Label>
                        <Textarea
                          id="bulk-vouchers"
                          value={bulkForm.vouchers}
                          onChange={(e) => setBulkForm(prev => ({ ...prev, vouchers: e.target.value }))}
                          className="bg-gray-100 border-gray-200 font-mono text-sm"
                          placeholder="Enter vouchers, one per line:&#10;PIN1 Serial1&#10;PIN2 Serial2&#10;PIN3 Serial3"
                          rows={10}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          Format: PIN Serial or PIN Tab Serial (one per line). Example:<br />
                          1234567890 ABC123456<br />
                          9876543210 XYZ987654
                        </p>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBulkCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkCreate} className="bg-blue-600 hover:bg-blue-700">
                        Create Vouchers
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isSingleUploadDialogOpen} onOpenChange={setIsSingleUploadDialogOpen}>
                  {/* <DialogTrigger asChild>
                    <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Single
                    </Button>
                  </DialogTrigger> */}
                  <DialogContent className="bg-gray-100 border-gray-200 text-gray-900">
                    <DialogHeader>
                      <DialogTitle>Upload Single Voucher</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Upload a voucher with PIN and Serial number
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="upload-type">Voucher Type</Label>
                        <Select value={singleUploadForm.type} onValueChange={(value: 'BECE' | 'WASSCE') => 
                          setSingleUploadForm(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger className="bg-gray-100 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-100 border-gray-200">
                            <SelectItem value="BECE">BECE</SelectItem>
                            <SelectItem value="WASSCE">WASSCE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="pin">PIN *</Label>
                        <Input
                          id="pin"
                          value={singleUploadForm.pin}
                          onChange={(e) => setSingleUploadForm(prev => ({ ...prev, pin: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                          placeholder="Enter PIN"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="serial">Serial *</Label>
                        <Input
                          id="serial"
                          value={singleUploadForm.serial}
                          onChange={(e) => setSingleUploadForm(prev => ({ ...prev, serial: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                          placeholder="Enter Serial"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="code">Code (Optional)</Label>
                        <Input
                          id="code"
                          value={singleUploadForm.code}
                          onChange={(e) => setSingleUploadForm(prev => ({ ...prev, code: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                          placeholder="Auto-generated if not provided"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="upload-expiresAt">Expiry Date (Optional)</Label>
                        <Input
                          id="upload-expiresAt"
                          type="datetime-local"
                          value={singleUploadForm.expiresAt}
                          onChange={(e) => setSingleUploadForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                          className="bg-gray-100 border-gray-200"
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSingleUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSingleUpload} 
                        disabled={uploading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {uploading ? 'Uploading...' : 'Upload Voucher'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCsvUploadDialogOpen} onOpenChange={setIsCsvUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-purple-600 text-black hover:bg-purple-50">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-100 border-gray-200 text-gray-900">
                    <DialogHeader>
                      <DialogTitle>Upload Vouchers from CSV</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Upload multiple vouchers from a CSV file. CSV must have columns: pin, serial (and optionally code)
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="csv-type">Voucher Type</Label>
                        <Select value={csvUploadForm.type} onValueChange={(value: 'BECE' | 'WASSCE') => 
                          setCsvUploadForm(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger className="bg-gray-100 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-100 border-gray-200">
                            <SelectItem value="BECE">BECE</SelectItem>
                            <SelectItem value="WASSCE">WASSCE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="csv-file">CSV File *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={downloadSampleCsv}
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download Sample
                          </Button>
                        </div>
                        <Input
                          id="csv-file"
                          type="file"
                          accept=".csv"
                          onChange={(e) => setCsvUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                          className="bg-gray-100 border-gray-200"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          CSV format: pin,serial,code (code is optional). Click "Download Sample" for an example file.
                        </p>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCsvUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCsvUpload} 
                        disabled={uploading || !csvUploadForm.file}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {uploading ? 'Uploading...' : 'Upload CSV'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={exportVouchers} className="border-gray-200 text-gray-300 hover:bg-gray-100">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search vouchers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-100 border-gray-200"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-32 bg-gray-100 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-100 border-gray-200 text-gray-900">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="BECE">BECE</SelectItem>
                  <SelectItem value="WASSCE">WASSCE</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-32 bg-gray-100 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-100 border-gray-200 text-gray-900">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="unused">Unused</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions */}
            {selectedVouchers.size > 0 && (
              <div className="flex items-center gap-2 p-4 bg-gray-100 border border-gray-200 rounded-lg">
                <span className="text-sm text-gray-300">
                  {selectedVouchers.size} voucher(s) selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    onClick={handleBulkMarkAsSold}
                    disabled={processingBulkAction}
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    Mark as Sold
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBulkDelete}
                    disabled={processingBulkAction}
                    className="border-red-600 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedVouchers(new Set())}
                    className="border-gray-200 text-gray-300 hover:bg-gray-100"
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}

            {/* Vouchers Table */}
            <div className="rounded-md border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-100">
                  <TableRow className="border-gray-200">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredVouchers.length > 0 && selectedVouchers.size === filteredVouchers.length}
                        onChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-gray-300">Code</TableHead>
                    <TableHead className="text-gray-300">PIN</TableHead>
                    <TableHead className="text-gray-300">Serial</TableHead>
                    <TableHead className="text-gray-300">Type</TableHead>
                    <TableHead className="text-gray-300">Price</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Owner</TableHead>
                    <TableHead className="text-gray-300">Used At</TableHead>
                    <TableHead className="text-gray-300">Created</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-400">
                        Loading vouchers...
                      </TableCell>
                    </TableRow>
                  ) : filteredVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-400">
                        No vouchers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVouchers.map((voucher) => (
                      <TableRow key={voucher.id} className="border-gray-200 hover:bg-gray-100">
                        <TableCell>
                          <Checkbox
                            checked={selectedVouchers.has(voucher.id)}
                            onChange={() => toggleVoucherSelection(voucher.id)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-900">
                          {voucher.code}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-300">
                          {voucher.pin || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-300">
                          {voucher.serial || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={voucher.type === 'BECE' ? 'default' : 'secondary'}>
                            {voucher.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-900">₵{Number(voucher.price).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={voucher.isActive ? 'default' : 'destructive'}>
                              {voucher.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {voucher.isUsed && (
                              <Badge variant="outline">Used</Badge>
                            )}
                            {voucher.isSold && (
                              <Badge variant="default" className="bg-green-600">Sold</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {voucher.user ? (
                            <div>
                              <div className="font-medium">{voucher.user.name}</div>
                              <div className="text-sm text-gray-400">{voucher.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {voucher.usedAt ? new Date(voucher.usedAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {new Date(voucher.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(voucher.id, voucher.isActive)}
                              className="border-gray-200 text-gray-300 hover:bg-gray-100"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {!voucher.isUsed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteVoucher(voucher.id)}
                                className="border-red-600 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
