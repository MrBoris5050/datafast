'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Zap,
  Users,
  Tag,
  BarChart3,
  ArrowRight,
  BadgeCheck,
  AlertCircle,
  Lock,
  CreditCard,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { Suspense } from 'react'

interface UpgradeInfo {
  enabled: boolean
  price: number | null
}

interface WalletInfo {
  balance: number
}

const agentBenefits = [
  {
    icon: Tag,
    title: 'Discounted Data Prices',
    description: 'Access exclusive agent pricing on all data bundles — buy cheaper, sell higher.'
  },
  {
    icon: TrendingUp,
    title: 'Higher Profit Margins',
    description: 'Earn more on every resale with better margins than regular customers.'
  },
  {
    icon: Users,
    title: 'Priority Support',
    description: 'Get faster response times from our support team for your business needs.'
  },
  {
    icon: BarChart3,
    title: 'Bulk Purchase Access',
    description: 'Access the bulk purchase tools to serve your customers efficiently.'
  },
  {
    icon: Zap,
    title: 'API Access',
    description: 'Integrate our platform into your own systems with full API access.'
  },
  {
    icon: BadgeCheck,
    title: 'Verified Agent Badge',
    description: 'Your account gets a verified agent badge, building trust with your customers.'
  }
]

function UpgradeToAgentPageInner() {
  const { data: session, update: updateSession } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null)
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWalletUpgrading, setIsWalletUpgrading] = useState(false)
  const [isPaystackLoading, setIsPaystackLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [upgraded, setUpgraded] = useState(false)

  const userRole = session?.user?.role

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [upgradeRes, walletRes] = await Promise.all([
        fetch('/api/user/upgrade-to-agent'),
        fetch('/api/dashboard/summary', { cache: 'no-store' })
      ])
      const upgradeData = await upgradeRes.json()
      const walletData = await walletRes.json()
      setUpgradeInfo(upgradeData)
      setWalletInfo({ balance: Number(walletData?.data?.walletBalance ?? 0) })
    } catch {
      toast({ title: 'Error', description: 'Failed to load upgrade info.', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Paystack callback — verify the reference that comes back in the URL
  useEffect(() => {
    const reference = searchParams.get('reference')
    if (!reference || !reference.startsWith('DLT_UPGRADE_')) return

    const verify = async () => {
      setIsVerifying(true)
      try {
        const res = await fetch('/api/user/upgrade-to-agent/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference })
        })
        const data = await res.json()

        if (!res.ok) {
          toast({ title: 'Payment Failed', description: data.error, variant: 'destructive' })
          return
        }

        setUpgraded(true)
        await updateSession()
        toast({
          title: 'Upgrade Successful!',
          description: 'Your account has been upgraded to Agent. Welcome aboard!'
        })
        setTimeout(() => router.push('/dashboard'), 2000)
      } catch {
        toast({ title: 'Error', description: 'Could not verify payment. Contact support if deducted.', variant: 'destructive' })
      } finally {
        setIsVerifying(false)
      }
    }

    verify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWalletUpgrade = async () => {
    setIsWalletUpgrading(true)
    try {
      const res = await fetch('/api/user/upgrade-to-agent', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Upgrade Failed', description: data.error, variant: 'destructive' })
        return
      }
      setUpgraded(true)
      await updateSession()
      toast({
        title: 'Upgrade Successful!',
        description: 'Your account has been upgraded to Agent. Welcome aboard!'
      })
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' })
    } finally {
      setIsWalletUpgrading(false)
    }
  }

  const handlePaystackUpgrade = async () => {
    setIsPaystackLoading(true)
    try {
      const res = await fetch('/api/user/upgrade-to-agent/paystack', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      // Redirect to Paystack checkout page
      window.location.href = data.authorizationUrl
    } catch {
      toast({ title: 'Error', description: 'Could not initiate payment. Please try again.', variant: 'destructive' })
      setIsPaystackLoading(false)
    }
  }

  const balance = walletInfo?.balance ?? 0
  const price = upgradeInfo?.price ?? 0
  const paystackCharge = price * 1.02
  const hasEnoughBalance = balance >= price
  const isAlreadyAgent = userRole && userRole !== 'CUSTOMER'
  const anyLoading = isWalletUpgrading || isPaystackLoading || isVerifying

  if (isVerifying) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center py-12 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Verifying your payment...</h2>
                  <p className="text-sm text-gray-500 mt-1">Please wait while we confirm your Paystack payment.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Become an Agent</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Upgrade your account to access exclusive agent pricing and grow your data reselling business.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : isAlreadyAgent ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <BadgeCheck className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">You&apos;re already an Agent!</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Your account already has the{' '}
                    <Badge className="bg-blue-100 text-blue-600 border-0 text-xs">{userRole?.toLowerCase()}</Badge>{' '}
                    role. You already enjoy all agent benefits.
                  </p>
                </div>
                <Button asChild className="mt-2">
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !upgradeInfo?.enabled ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <Lock className="h-7 w-7 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upgrade Unavailable</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Agent upgrades are temporarily unavailable. Please check back later or contact support.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : upgraded ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upgrade Successful!</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Welcome to the Agent family! Redirecting you to the dashboard...
                  </p>
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
           

            {/* Payment column */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Agent Upgrade</CardTitle>
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">One-time fee</Badge>
                  </div>
                  <CardDescription>Pay once and keep the Agent role forever</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Price */}
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-5 text-white text-center">
                    <p className="text-sm text-blue-200 mb-1">Upgrade Price</p>
                    <p className="text-4xl font-bold">GHS {price.toFixed(2)}</p>
                    <p className="text-xs text-blue-200 mt-1">One-time payment</p>
                  </div>

                  {/* Option 1 — Wallet */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Pay from Wallet</span>
                    </div>

                    <div className={`rounded-xl p-3 border ${hasEnoughBalance ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Your balance</span>
                        <span className={`text-sm font-bold ${hasEnoughBalance ? 'text-emerald-700' : 'text-red-600'}`}>
                          GHS {balance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {!hasEnoughBalance && (
                      <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Need GHS {(price - balance).toFixed(2)} more.{' '}
                          <Link href="/dashboard/wallet" className="underline font-medium">
                            Top up wallet
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={!hasEnoughBalance || anyLoading}
                      onClick={handleWalletUpgrade}
                    >
                      {isWalletUpgrading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4 mr-2" />
                          Pay GHS {price.toFixed(2)} from Wallet
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">OR</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Option 2 — Paystack */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Pay with Paystack</span>
                      <span className="text-[10px] text-gray-400 ml-auto">+2% fee</span>
                    </div>

                    <div className="rounded-xl p-3 border border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Total charged</span>
                        <span className="text-sm font-bold text-gray-700">
                          GHS {paystackCharge.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Includes 2% Paystack processing fee
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                      disabled={anyLoading}
                      onClick={handlePaystackUpgrade}
                    >
                      {isPaystackLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay GHS {paystackCharge.toFixed(2)} via Paystack
                          <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-60" />
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    By upgrading, you agree to our terms. The fee is non-refundable.
                  </p>
                </CardContent>
              </Card>
            </div>
             {/* Benefits column */}
             <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">What you get as an Agent</CardTitle>
                  <CardDescription>All the tools and perks to grow your reselling business</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {agentBenefits.map((benefit) => (
                      <div
                        key={benefit.title}
                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-100 flex-shrink-0">
                          <benefit.icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{benefit.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function UpgradeToAgentPage() {
  return (
    <Suspense>
      <UpgradeToAgentPageInner />
    </Suspense>
  )
}
