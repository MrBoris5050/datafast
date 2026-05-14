'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Ticket, ShoppingCart, Plus, Search, GraduationCap, Copy, Check, FileText, Printer } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface Voucher {
  id: string
  code: string
  serial?: string
  pin?: string
  type: 'BECE' | 'WASSCE'
  price: number
  isUsed: boolean
  usedAt?: string
  createdAt: string
  purchases?: Array<{
    phoneNumber?: string
    createdAt: string
  }>
}

interface VoucherStats {
  total: number
  bece: {
    total: number
    used: number
    unused: number
  }
  wassce: {
    total: number
    used: number
    unused: number
  }
  totalValue: number
}

export default function VouchersPage() {
  const { toast } = useToast()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    bece: { total: 0, used: 0, unused: 0 },
    wassce: { total: 0, used: 0, unused: 0 },
    totalValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<any>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({
    type: 'BECE' as 'BECE' | 'WASSCE',
    quantity: '1',
    phoneNumber: ''
  })

  useEffect(() => {
    fetchMyVouchers()
  }, [])

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

  const handlePurchaseVouchers = async () => {
    if (!purchaseForm.phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive"
      })
      return
    }

    try {
      setPurchasing(true)
      const response = await fetch('/api/vouchers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: purchaseForm.type,
          quantity: parseInt(purchaseForm.quantity),
          paymentMethod: 'wallet',
          phoneNumber: purchaseForm.phoneNumber.trim()
        })
      })

      const data = await response.json()

      if (response.ok) {
        setPurchaseResult(data)
        setIsPurchaseDialogOpen(false)
        setIsSuccessModalOpen(true)
        setPurchaseForm({ type: 'BECE', quantity: '1', phoneNumber: '' })
        fetchMyVouchers()
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to purchase vouchers',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error purchasing vouchers",
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
      description: "Copied to clipboard"
    })
  }

  const exportToCSV = () => {
    if (!purchaseResult?.vouchers) return

    const headers = ['Voucher', 'Serial', 'PIN', 'Combined']
    const rows = purchaseResult.vouchers.map((v: any, index: number) => [
      `Voucher ${index + 1}`,
      v.serial || '',
      v.pin || '',
      v.serial && v.pin ? `SERIAL: ${v.serial} | PIN: ${v.pin}` : v.code
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${purchaseResult.vouchers[0]?.type?.toLowerCase() || 'voucher'}-vouchers-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const printCards = () => {
    window.print()
  }

  const [voucherPricing, setVoucherPricing] = useState<{ type: string; price: number }[]>([])

  useEffect(() => {
    fetchVoucherPricing()
  }, [])

  const fetchVoucherPricing = async () => {
    try {
      const response = await fetch('/api/vouchers/pricing')
      if (response.ok) {
        const data = await response.json()
        setVoucherPricing(data.pricing)
      }
    } catch (error) {
      console.error('Error fetching voucher pricing:', error)
    }
  }

  const getVoucherPrice = (type: 'BECE' | 'WASSCE') => {
    const pricing = voucherPricing.find(p => p.type === type)
    return pricing ? Number(pricing.price) : (type === 'BECE' ? 5.00 : 10.00)
  }

  return (
    <DashboardLayout title="My Vouchers">
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">Total Vouchers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">BECE Vouchers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.bece.total}</div>
              <div className="text-xs sm:text-sm text-gray-500">{stats.bece.unused} available</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">WASSCE Vouchers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.wassce.total}</div>
              <div className="text-xs sm:text-sm text-gray-500">{stats.wassce.unused} available</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">Total Value</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600">₵{stats.totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Card className="bg-white border-gray-200">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-gray-900 text-sm sm:text-base">BECE Results</CardTitle>
                  <CardDescription className="text-gray-500 text-xs sm:text-sm">Check BECE examination results</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Available vouchers: {stats.bece.unused}</p>
                  <p className="text-xs text-gray-400">₵{getVoucherPrice('BECE').toFixed(2)} per voucher</p>
                </div>
                <Link href="/dashboard/services/result-checker" className="w-full sm:w-auto">
                  <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm">
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                    Check Results
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <div>
                  <CardTitle className="text-gray-900 text-sm sm:text-base">WASSCE Results</CardTitle>
                  <CardDescription className="text-gray-500 text-xs sm:text-sm">Check WASSCE examination results</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Available vouchers: {stats.wassce.unused}</p>
                  <p className="text-xs text-gray-400">₵{getVoucherPrice('WASSCE').toFixed(2)} per voucher</p>
                </div>
                <Link href="/dashboard/services/result-checker" className="w-full sm:w-auto">
                  <Button className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm">
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                    Check Results
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-gray-900">Voucher Management</CardTitle>
                <CardDescription className="text-gray-500">
                  Purchase and manage your result checker vouchers
                </CardDescription>
              </div>
              
              <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Buy Vouchers
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-gray-200 text-gray-900">
                  <DialogHeader>
                    <DialogTitle>Purchase Vouchers</DialogTitle>
                    <DialogDescription className="text-gray-500">
                      Buy vouchers to check examination results
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="type">Voucher Type</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button
                          variant={purchaseForm.type === 'BECE' ? 'default' : 'outline'}
                          onClick={() => setPurchaseForm(prev => ({ ...prev, type: 'BECE' }))}
                          className="justify-start"
                        >
                          <GraduationCap className="h-4 w-4 mr-2" />
                          BECE (₵{getVoucherPrice('BECE').toFixed(2)})
                        </Button>
                        <Button
                          variant={purchaseForm.type === 'WASSCE' ? 'default' : 'outline'}
                          onClick={() => setPurchaseForm(prev => ({ ...prev, type: 'WASSCE' }))}
                          className="justify-start"
                        >
                          <GraduationCap className="h-4 w-4 mr-2" />
                          WASSCE (₵{getVoucherPrice('WASSCE').toFixed(2)})
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="10"
                        value={purchaseForm.quantity}
                        onChange={(e) => setPurchaseForm(prev => ({ ...prev, quantity: e.target.value }))}
                        className="bg-white border-gray-200"
                        placeholder="Enter quantity"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={purchaseForm.phoneNumber}
                        onChange={(e) => setPurchaseForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="bg-white border-gray-200"
                        placeholder="e.g., 0549664205"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Voucher details will be sent to this number via SMS
                      </p>
                    </div>
                    
                    <div className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">
                      <p>Total cost: ₵{(parseInt(purchaseForm.quantity) * getVoucherPrice(purchaseForm.type)).toFixed(2)}</p>
                      <p className="text-xs mt-1">Payment will be deducted from your wallet balance</p>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handlePurchaseVouchers} 
                      disabled={purchasing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {purchasing ? 'Purchasing...' : 'Purchase'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Success Modal */}
              <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
                <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-green-600">
                      Voucher Purchased Successfully!
                    </DialogTitle>
                  </DialogHeader>
                  
                  {purchaseResult && (
                    <div className="space-y-4">
                      {/* Voucher Details */}
                      <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Voucher Type:</span>
                          <span className="font-semibold">{purchaseResult.vouchers?.[0]?.type || purchaseForm.type} Results Checker</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Recipient:</span>
                          <span className="font-semibold">{purchaseResult.phoneNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quantity:</span>
                          <span className="font-semibold">{purchaseResult.vouchers?.length || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount:</span>
                          <span className="font-semibold">₵{Number(purchaseResult.totalCost).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Voucher Codes */}
                      <div>
                        <h3 className="font-semibold mb-3">Voucher Codes:</h3>
                        <div className="space-y-3">
                          {purchaseResult.vouchers?.map((voucher: any, index: number) => (
                            <div key={voucher.id} className="bg-gray-100 rounded-lg p-4 space-y-2">
                              <div className="text-sm font-medium text-gray-600 mb-2">
                                Voucher {index + 1}
                              </div>
                              {voucher.serial && (
                                <div className="flex items-center justify-between">
                                      <span className="text-gray-500">SERIAL:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold">{voucher.serial}</span>
                                   
                                  </div>
                                </div>
                              )}
                              {voucher.pin && (
                                <div className="flex items-center justify-between">
                                      <span className="text-gray-500">PIN:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold">{voucher.pin}</span>
                                   
                                  </div>
                                </div>
                              )}
                              {voucher.serial && voucher.pin && (
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                        <span className="text-gray-500">COMBINED:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs">
                                      SERIAL: {voucher.serial} | PIN: {voucher.pin}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(`SERIAL: ${voucher.serial} | PIN: ${voucher.pin}`, index * 3 + 3)}
                                        className="h-7 px-2 border-gray-200"
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
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">New Balance:</span>
                          <span className="font-semibold">₵{Number(purchaseResult.newBalance || 0).toFixed(2)}</span>
                        </div>
                          <div className="flex items-center justify-between">
                          <span className="text-gray-500">Delivery Status:</span>
                          <div className="flex items-center gap-2">
                            {purchaseResult.smsSent ? (
                              <>
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="text-green-600 font-semibold">SMS Sent</span>
                              </>
                            ) : (
                              <span className="text-yellow-600">SMS Pending</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {purchaseResult.phoneNumber && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-600">
                            <strong>Note:</strong> The voucher codes have been sent via SMS to {purchaseResult.phoneNumber}
                          </p>
                        </div>
                      )}
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
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100">
                <TabsTrigger value="all">All Vouchers</TabsTrigger>
                <TabsTrigger value="bece">BECE</TabsTrigger>
                <TabsTrigger value="wassce">WASSCE</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <VoucherTable vouchers={vouchers} loading={loading} />
              </TabsContent>

              <TabsContent value="bece">
                <VoucherTable vouchers={vouchers.filter(v => v.type === 'BECE')} loading={loading} />
              </TabsContent>

              <TabsContent value="wassce">
                <VoucherTable vouchers={vouchers.filter(v => v.type === 'WASSCE')} loading={loading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function VoucherTable({ vouchers, loading }: { vouchers: Voucher[], loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading vouchers...</div>
  }

  if (vouchers.length === 0) {
    return (
      <div className="text-center py-8">
        <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Vouchers Found</h3>
        <p className="text-gray-500">Purchase vouchers to check examination results</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-100">
          <TableRow className="border-gray-200">
            <TableHead className="text-gray-600">Type</TableHead>
            <TableHead className="text-gray-600">Serial</TableHead>
            <TableHead className="text-gray-600">Pin</TableHead>
            <TableHead className="text-gray-600">Recipient</TableHead>
            <TableHead className="text-gray-600">DateTime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vouchers.map((voucher) => (
            <TableRow key={voucher.id} className="border-gray-200 hover:bg-gray-50">
              <TableCell>
                <Badge variant={voucher.type === 'BECE' ? 'default' : 'secondary'}>
                  {voucher.type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm text-gray-900">
                {voucher.serial || '-'}
              </TableCell>
              <TableCell className="font-mono text-sm text-gray-900">
                {voucher.pin || '-'}
              </TableCell>
              <TableCell className="text-gray-600">
                {voucher.purchases && voucher.purchases.length > 0 && voucher.purchases[0].phoneNumber
                  ? voucher.purchases[0].phoneNumber
                  : '-'}
              </TableCell>
              <TableCell className="text-gray-600">
                {new Date(voucher.createdAt).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
