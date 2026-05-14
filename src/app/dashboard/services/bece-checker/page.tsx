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
import Link from 'next/link'
import { ArrowLeft, GraduationCap, ShoppingCart, Ticket, Plus, Copy, Check, FileText, Printer } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Voucher {
  id: string
  code: string
  type: 'BECE' | 'WASSCE'
  price: number
  isUsed: boolean
  usedAt?: string
  createdAt: string
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

export default function BeceCheckerPage() {
  const { toast } = useToast()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    bece: { total: 0, used: 0, unused: 0 },
    wassce: { total: 0, used: 0, unused: 0 },
    totalValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [becePrice, setBecePrice] = useState(5.00)
  const [purchasing, setPurchasing] = useState(false)
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<any>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Purchase form
  const [purchaseQuantity, setPurchaseQuantity] = useState('1')
  const [purchasePhoneNumber, setPurchasePhoneNumber] = useState('')

  useEffect(() => {
    fetchMyVouchers()
    fetchVoucherPricing()
  }, [])

  const fetchVoucherPricing = async () => {
    try {
      const response = await fetch('/api/vouchers/pricing')
      if (response.ok) {
        const data = await response.json()
        const bece = data.pricing.find((p: any) => p.type === 'BECE')
        if (bece) setBecePrice(Number(bece.price))
      }
    } catch (error) {
      console.error('Error fetching voucher pricing:', error)
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

  const handlePurchaseVouchers = async () => {
    if (!purchasePhoneNumber.trim()) {
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
          type: 'BECE',
          quantity: parseInt(purchaseQuantity),
          paymentMethod: 'wallet',
          phoneNumber: purchasePhoneNumber.trim()
        })
      })

      const data = await response.json()

      if (response.ok) {
        setPurchaseResult(data)
        setIsPurchaseDialogOpen(false)
        setIsSuccessModalOpen(true)
        setPurchaseQuantity('1')
        setPurchasePhoneNumber('')
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
    a.download = `bece-vouchers-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const printCards = () => {
    window.print()
  }

  const beceVouchers = vouchers.filter(v => v.type === 'BECE')

  return (
    <DashboardLayout title="BECE Checker" subtitle="Purchase and verify BECE result checker">
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="border-gray-200 text-gray-600 hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm text-gray-500">Back to Dashboard</span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total BECE Vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.bece.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.bece.unused}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.bece.used}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vouchers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 bg-gray-100 border-gray-200">
            <TabsTrigger value="vouchers" className="data-[state=active]:bg-white">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="vouchers" className="space-y-4">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-gray-900">BECE Result Checker</CardTitle>
                      <CardDescription className="text-gray-500">Use your voucher to check BECE results</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700">
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Buy Vouchers
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-gray-200 text-gray-900">
                        <DialogHeader>
                          <DialogTitle>Purchase BECE Vouchers</DialogTitle>
                          <DialogDescription className="text-gray-500">
                            Buy vouchers to check BECE results. Each voucher can be used 3 times for the same index number!.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input
                              id="quantity"
                              type="number"
                              min="1"
                              max="10"
                              value={purchaseQuantity}
                              onChange={(e) => setPurchaseQuantity(e.target.value)}
                              className="bg-white border-gray-200"
                              placeholder="Enter quantity"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="phoneNumber">Phone Number *</Label>
                            <Input
                              id="phoneNumber"
                              type="tel"
                              value={purchasePhoneNumber}
                              onChange={(e) => setPurchasePhoneNumber(e.target.value)}
                              className="bg-white border-gray-200"
                              placeholder="e.g., 0549664205"
                              required
                            />
                              <p className="text-xs text-gray-500 mt-1">
                              Voucher details will be sent to this number via SMS
                            </p>
                          </div>
                          
                          <div className="text-sm text-gray-500">
                            <p>Price per voucher: ₵{becePrice.toFixed(2)}</p>
                            <p>Total cost: ₵{(parseInt(purchaseQuantity) * becePrice).toFixed(2)}</p>
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
                                <span className="font-semibold">BECE Results Checker</span>
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Ticket className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">My BECE Vouchers</h3>
                  <p className="text-gray-500 mb-4">
                    {stats.bece.unused > 0 
                      ? `You have ${stats.bece.unused} unused BECE voucher${stats.bece.unused !== 1 ? 's' : ''} available`
                      : 'You have no unused BECE vouchers. Purchase vouchers to get started.'}
                  </p>
                  <Button 
                    onClick={() => setIsPurchaseDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Vouchers
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">My BECE Vouchers</CardTitle>
                <CardDescription className="text-gray-500">
                  View and manage your BECE result checker vouchers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading vouchers...</div>
                ) : beceVouchers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No BECE vouchers found</div>
                ) : (
                  <div className="rounded-md border border-gray-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-100">
                        <TableRow className="border-gray-200">
                          <TableHead className="text-gray-600">Code</TableHead>
                          <TableHead className="text-gray-600">Price</TableHead>
                          <TableHead className="text-gray-600">Status</TableHead>
                          <TableHead className="text-gray-600">Used At</TableHead>
                          <TableHead className="text-gray-600">Purchased</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {beceVouchers.map((voucher) => (
                          <TableRow key={voucher.id} className="border-gray-200 hover:bg-gray-50">
                            <TableCell className="font-mono text-sm text-gray-900">
                              {voucher.code}
                            </TableCell>
                            <TableCell className="text-gray-900">₵{Number(voucher.price).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={voucher.isUsed ? 'destructive' : 'default'}>
                                {voucher.isUsed ? 'Used' : 'Available'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {voucher.usedAt ? new Date(voucher.usedAt).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {new Date(voucher.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}


