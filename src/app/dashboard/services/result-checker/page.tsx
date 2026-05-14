'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { 
  ArrowLeft, 
  GraduationCap, 
  ShoppingCart, 
  Copy, 
  Check, 
  FileText, 
  Printer, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Wallet,
  TrendingUp
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Voucher {
  id: string
  code: string
  pin?: string | null
  serial?: string | null
  type: 'BECE' | 'WASSCE'
  price: number
  isUsed: boolean
  usedAt?: string | null
  createdAt: string
  purchases?: Array<{
    reference: string
    createdAt: string
    method: string
    phoneNumber?: string | null
  }>
}

interface VoucherStats {
  total: number
  bece: {
    total: number
    used: number
    unused: number
    available: number // System-wide available vouchers
  }
  wassce: {
    total: number
    used: number
    unused: number
    available: number // System-wide available vouchers
  }
  totalValue: number
}

interface PurchaseFormData {
  quantity: string
  phoneNumber: string
}

interface PurchaseResult {
  vouchers: Array<{
    id: string
    code: string
    pin?: string | null
    serial?: string | null
    type: 'BECE' | 'WASSCE'
    price: number
    createdAt: string
  }>
  totalCost: number
  reference: string
  newBalance: number
  phoneNumber: string | null
  smsSent: boolean
  smsError: string | null
}

export default function ResultCheckerPage() {
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<'BECE' | 'WASSCE' | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    bece: { total: 0, used: 0, unused: 0, available: 0 },
    wassce: { total: 0, used: 0, unused: 0, available: 0 },
    totalValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [becePrice, setBecePrice] = useState(5.00)
  const [wasscePrice, setWasscePrice] = useState(10.00)
  const [purchasing, setPurchasing] = useState(false)
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'vouchers'>('overview')

  const [formData, setFormData] = useState<PurchaseFormData>({
    quantity: '1',
    phoneNumber: ''
  })

  const [formErrors, setFormErrors] = useState<Partial<PurchaseFormData>>({})

  const handleSelectType = useCallback((type: 'BECE' | 'WASSCE') => {
    setSelectedType(type)
    setFormData({ quantity: '1', phoneNumber: '' })
    setFormErrors({})
    setIsPurchaseDialogOpen(true)
  }, [])

  useEffect(() => {
    fetchMyVouchers()
    fetchVoucherPricing()
    fetchVoucherAvailability()
  }, [])

  const fetchVoucherPricing = async () => {
    try {
      const response = await fetch('/api/vouchers/pricing')
      if (response.ok) {
        const data = await response.json()
        const bece = data.pricing.find((p: any) => p.type === 'BECE')
        const wassce = data.pricing.find((p: any) => p.type === 'WASSCE')
        if (bece) setBecePrice(Number(bece.price))
        if (wassce) setWasscePrice(Number(wassce.price))
      }
    } catch (error) {
      console.error('Error fetching voucher pricing:', error)
    }
  }

  const fetchVoucherAvailability = async () => {
    try {
      const response = await fetch('/api/vouchers/availability')
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({
          ...prev,
          bece: { ...prev.bece, available: data.stats.bece.available },
          wassce: { ...prev.wassce, available: data.stats.wassce.available }
        }))
      }
    } catch (error) {
      console.error('Error fetching voucher availability:', error)
    }
  }

  const fetchMyVouchers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vouchers/my-vouchers')
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

  const isFormValid = (): boolean => {
    const phoneNumber = formData.phoneNumber.trim()
    const quantity = parseInt(formData.quantity)
    
    // Check phone number
    if (!phoneNumber) return false
    if (phoneNumber.length > 10) return false
    if (!/^0\d{9}$/.test(phoneNumber)) return false
    
    // Check quantity
    if (!quantity || quantity < 1 || quantity > 10) return false
    
    return true
  }

  const validateForm = (): boolean => {
    const errors: Partial<PurchaseFormData> = {}
    const phoneNumber = formData.phoneNumber.trim()
    
    if (!phoneNumber) {
      errors.phoneNumber = 'Phone number is required'
    } else if (phoneNumber.length > 10) {
      errors.phoneNumber = 'Phone number must be exactly 10 digits'
    } else if (!/^0\d{9}$/.test(phoneNumber)) {
      errors.phoneNumber = 'Phone number must be exactly 10 digits and start with 0'
    }

    const quantity = parseInt(formData.quantity)
    if (!quantity || quantity < 1 || quantity > 10) {
      errors.quantity = 'Quantity must be between 1 and 10'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all spaces from input
    const value = e.target.value.replace(/\s/g, '')
    setFormData({ ...formData, phoneNumber: value })
    
    // Real-time validation
    const errors: Partial<PurchaseFormData> = { ...formErrors }
    if (!value.trim()) {
      errors.phoneNumber = 'Phone number is required'
    } else if (value.length > 10) {
      errors.phoneNumber = 'Phone number must be exactly 10 digits'
    } else if (!/^0\d{9}$/.test(value)) {
      if (value.length === 10 && !value.startsWith('0')) {
        errors.phoneNumber = 'Phone number must start with 0'
      } else if (value.length < 10) {
        // Don't show error while typing if less than 10 digits
        delete errors.phoneNumber
      } else {
        errors.phoneNumber = 'Phone number must be exactly 10 digits and start with 0'
      }
    } else {
      delete errors.phoneNumber
    }
    setFormErrors(errors)
  }

  const handlePurchaseVouchers = async () => {
    if (!selectedType) return
    
    if (!validateForm()) {
      return
    }

    try {
      setPurchasing(true)
      const response = await fetch('/api/vouchers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          quantity: parseInt(formData.quantity),
          paymentMethod: 'wallet',
          phoneNumber: formData.phoneNumber.trim()
        })
      })

      const data = await response.json()

      if (response.ok) {
        setPurchaseResult(data)
        setIsPurchaseDialogOpen(false)
        setIsSuccessModalOpen(true)
        setFormData({ quantity: '1', phoneNumber: '' })
        setFormErrors({})
        fetchMyVouchers()
        fetchVoucherAvailability() // Refresh availability after purchase
        setActiveTab('vouchers')
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || 'Failed to purchase vouchers',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while purchasing vouchers. Please try again.",
        variant: "destructive"
      })
    } finally {
      setPurchasing(false)
    }
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
    toast({
      title: "Copied",
      description: "Copied to clipboard",
      duration: 2000
    })
  }

  const copyAllVouchers = () => {
    if (!purchaseResult?.vouchers || !selectedType) return
    
    const url = selectedType === 'WASSCE' ? 'ghana.waecdirect.org' : 'eresults.waecgh.org'
    
    const voucherLines = purchaseResult.vouchers
      .filter((v) => v.serial && v.pin)
      .map((v) => `Serial: ${v.serial} - Pin: ${v.pin}`)
      .join('\n')
    
    const allVouchersText = `${selectedType} Checker\n\n${voucherLines}\n\n${url}`
    
    navigator.clipboard.writeText(allVouchersText)
    setCopiedIndex(-1)
    setTimeout(() => setCopiedIndex(null), 2000)
    toast({
      title: "Copied All",
      description: "All voucher details copied to clipboard",
      duration: 2000
    })
  }

  const exportToCSV = () => {
    if (!purchaseResult?.vouchers) return

    const headers = ['Voucher', 'Serial', 'PIN', 'Combined']
    const rows = purchaseResult.vouchers.map((v, index) => [
      `Voucher ${index + 1}`,
      v.serial || '',
      v.pin || '',
      v.serial && v.pin ? `SERIAL: ${v.serial} | PIN: ${v.pin}` : v.code
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedType?.toLowerCase() || 'voucher'}-vouchers-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    toast({
      title: "Exported",
      description: "Vouchers exported to CSV successfully",
      duration: 2000
    })
  }

  const printCards = () => {
    window.print()
  }

  const currentPrice = selectedType === 'BECE' ? becePrice : wasscePrice
  const totalCost = parseInt(formData.quantity) * currentPrice

  return (
    <DashboardLayout title="Result Checker" >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="border-gray-200 text-gray-600 hover:bg-gray-100">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Result Checker</h1>
              <p className="text-sm text-gray-500">Purchase and manage examination result checker vouchers</p>
            </div>
          </div>
        </div>

        

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'vouchers')} className="space-y-4 text-gray-900">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 border-gray-200">
            <TabsTrigger value="overview" className="data-[state=inactive]:bg-gray-200">Overview</TabsTrigger>
            <TabsTrigger value="vouchers" className="data-[state=inactive]:bg-gray-200">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BECE Card */}
              <Card className="bg-white border-gray-200 hover:border-blue-400 transition-all duration-300">
                <CardHeader className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-blue-50 rounded-xl">
                        <GraduationCap className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-gray-900 text-xl">BECE Results</CardTitle>
                        <CardDescription className="text-gray-500">Basic Education Certificate Examination</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                      <span className="text-gray-500">Price per voucher:</span>
                      <span className="text-2xl font-bold text-gray-900">₵{becePrice.toFixed(2)}</span>
                    </div>
                    {/* <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                      <span className="text-gray-400">Available vouchers:</span>
                      <Badge variant="default" className="bg-green-500 text-sm px-3 py-1">
                        {stats.bece.unused}
                      </Badge>
                    </div> */}
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-base h-12"
                      onClick={() => handleSelectType('BECE')}
                      disabled={stats.bece.available === 0}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Purchase BECE Vouchers
                    </Button>
                    {stats.bece.available === 0 && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-700 text-sm">
                          No BECE vouchers available at the moment
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* WASSCE Card */}
              <Card className="bg-white border-gray-200 hover:border-purple-400 transition-all duration-300">
                <CardHeader className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-50 rounded-xl">
                        <GraduationCap className="h-8 w-8 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-gray-900 text-xl">WASSCE Results</CardTitle>
                        <CardDescription className="text-gray-500">West African Senior School Certificate Examination</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                      <span className="text-gray-500">Price per voucher:</span>
                      <span className="text-2xl font-bold text-gray-900">₵{wasscePrice.toFixed(2)}</span>
                    </div>
                    {/* <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                      <span className="text-gray-400">Available vouchers:</span>
                      <Badge variant="default" className="bg-green-500 text-sm px-3 py-1">
                        {stats.wassce.unused}
                      </Badge>
                    </div> */}
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700 text-base h-12"
                      onClick={() => handleSelectType('WASSCE')}
                      disabled={stats.wassce.available === 0}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Purchase WASSCE Vouchers
                    </Button>
                    {stats.wassce.available === 0 && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-700 text-sm">
                          No WASSCE vouchers available at the moment
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">BECE Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.bece.available}</div>
              {/* <p className="text-xs text-gray-500 mt-1">{stats.bece.used} used</p> */}
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">WASSCE Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.wassce.available}</div>
              {/* <p className="text-xs text-gray-500 mt-1">{stats.wassce.used} used</p> */}
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₵{stats.totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

          <TabsContent value="vouchers" className="space-y-4">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">My Vouchers</CardTitle>
                <CardDescription className="text-gray-500">
                  View and manage all your result checker vouchers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Loading vouchers...</p>
                  </div>
                ) : vouchers.length === 0 ? (
                  <div className="text-center py-12">
                    <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No vouchers found</h3>
                    <p className="text-gray-500 mb-4">Purchase vouchers to get started</p>
                    <Button 
                      onClick={() => setActiveTab('overview')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase Vouchers
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-gray-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-100">
                        <TableRow className="border-gray-200">
                          <TableHead className="text-gray-600">Type</TableHead>
                          <TableHead className="text-gray-600">PIN</TableHead>
                          <TableHead className="text-gray-600">Serial</TableHead>
                          <TableHead className="text-gray-600">Recipient</TableHead>
                          <TableHead className="text-gray-600">Status</TableHead>
                          <TableHead className="text-gray-600">Purchase Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vouchers.map((voucher) => {
                          const purchase = voucher.purchases?.[0]
                          return (
                            <TableRow key={voucher.id} className="border-gray-200 hover:bg-gray-50">
                              <TableCell>
                                <Badge variant={voucher.type === 'BECE' ? 'default' : 'secondary'}>
                                  {voucher.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-gray-900">
                                {voucher.pin || '-'}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-gray-900">
                                {voucher.serial || '-'}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {purchase?.phoneNumber || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={voucher.isUsed ? 'destructive' : 'default'}>
                                  {voucher.isUsed ? 'Used' : 'Available'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {purchase?.createdAt 
                                  ? new Date(purchase.createdAt).toLocaleDateString() 
                                  : new Date(voucher.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Purchase Dialog */}
        <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="text-lg sm:text-xl">Purchase {selectedType} Vouchers</DialogTitle>
              <DialogDescription className="text-gray-500 text-xs sm:text-sm">
                Buy vouchers to check {selectedType} results. Each voucher can be used 3 times for the same index number.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div>
                <Label htmlFor="quantity" className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="bg-white border-gray-200 text-gray-900 h-10 sm:h-11 text-sm sm:text-base"
                  placeholder="Enter quantity (1-10)"
                />
                {formErrors.quantity && (
                  <p className="text-red-600 text-xs mt-1">{formErrors.quantity}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="phoneNumber" className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">
                  Phone Number <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handlePhoneNumberChange}
                    onBlur={validateForm}
                    // maxLength={10}
                    className="bg-white border-gray-200 text-gray-900 pl-9 sm:pl-10 h-10 sm:h-11 text-sm sm:text-base"
                    placeholder="e.g., 0549664205"
                    required
                  />
                </div>
                {formErrors.phoneNumber && (
                  <p className="text-red-600 text-xs mt-1">{formErrors.phoneNumber}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Voucher details will be sent to this number via SMS
                </p>
              </div>
              
              <div className="bg-gray-100 rounded-lg p-3 sm:p-4 space-y-1.5 sm:space-y-2 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Price per voucher:</span>
                  <span className="text-sm sm:text-base font-semibold text-gray-900">₵{currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 sm:pt-2 border-t border-gray-200">
                  <span className="text-sm sm:text-base text-gray-700 font-medium">Total cost:</span>
                  <span className="text-lg sm:text-xl font-bold text-green-600">₵{totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2 flex-col sm:flex-row pt-2 sm:pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsPurchaseDialogOpen(false)
                  setSelectedType(null)
                  setFormData({ quantity: '1', phoneNumber: '' })
                  setFormErrors({})
                }}
                className="border-gray-200 text-gray-600 hover:bg-gray-100 w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePurchaseVouchers} 
                disabled={purchasing || !selectedType || !isFormValid()}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />
                    Purchasing...
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                    Purchase
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Voucher Purchased Successfully!
              </DialogTitle>
            </DialogHeader>
            
            {purchaseResult && (
              <div className="space-y-4">
                {/* Summary Card */}
                <Card className="bg-gray-100 border-gray-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-500 text-sm">Voucher Type:</span>
                        <p className="font-semibold text-gray-900">{selectedType} Results Checker</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Recipient:</span>
                        <p className="font-semibold text-gray-900 break-all">{purchaseResult.phoneNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Quantity:</span>
                        <p className="font-semibold text-gray-900">{purchaseResult.vouchers?.length || 0}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Amount:</span>
                        <p className="font-semibold text-green-600">₵{Number(purchaseResult.totalCost).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">New Balance:</span>
                        <span className="font-semibold text-gray-900">₵{Number(purchaseResult.newBalance || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SMS Status */}
                {purchaseResult.phoneNumber && (
                  <                  Alert className={purchaseResult.smsSent ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
                    {purchaseResult.smsSent ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          Voucher codes have been sent via SMS to {purchaseResult.phoneNumber}
                        </AlertDescription>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-700">
                          SMS delivery pending. Voucher codes are displayed below.
                        </AlertDescription>
                      </>
                    )}
                  </Alert>
                )}

                {/* Copy All Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={copyAllVouchers}
                    className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                  >
                    {copiedIndex === -1 ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied All
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All Vouchers
                      </>
                    )}
                  </Button>
                </div>

                {/* Voucher Codes */}
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Voucher Codes:</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {purchaseResult.vouchers?.map((voucher, index) => (
                      <Card key={voucher.id} className="bg-gray-100 border-gray-200">
                        <CardContent className="p-4 space-y-2">
                          <div className="text-sm font-medium text-gray-600 mb-3">
                            Voucher {index + 1}
                          </div>
                          {voucher.serial && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 text-sm">SERIAL:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{voucher.serial}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(voucher.serial!, index * 3 + 1)}
                                  className="h-7 w-7 p-0"
                                >
                                  {copiedIndex === index * 3 + 1 ? (
                                    <Check className="h-3 w-3 text-green-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          {voucher.pin && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 text-sm">PIN:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{voucher.pin}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(voucher.pin!, index * 3 + 2)}
                                  className="h-7 w-7 p-0"
                                >
                                  {copiedIndex === index * 3 + 2 ? (
                                    <Check className="h-3 w-3 text-green-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          {voucher.serial && voucher.pin && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <span className="text-gray-500 text-sm">COMBINED:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs break-all">
                                  SERIAL: {voucher.serial} | PIN: {voucher.pin}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(`SERIAL: ${voucher.serial} | PIN: ${voucher.pin}`, index * 3 + 3)}
                                  className="h-7 w-7 p-0"
                                >
                                  {copiedIndex === index * 3 + 3 ? (
                                    <Check className="h-3 w-3 text-green-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="flex-1 bg-green-600 hover:bg-green-700 border-green-600"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={printCards}
                className="flex-1 bg-red-600 hover:bg-red-700 border-red-600"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Cards
              </Button>
              <Button
                onClick={() => setIsSuccessModalOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
