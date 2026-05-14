"use client"

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function PaymentCallbackInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState('')
  const [isWalletTopup, setIsWalletTopup] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    const reference = searchParams.get('reference')
    const status = searchParams.get('status')

    if (reference && status === 'success') {
      // First, quickly check if it's a wallet topup and redirect immediately
      checkAndRedirect(reference)
    } else {
      setStatus('error')
      setMessage('Payment was not successful')
    }
  }, [searchParams, router])

  const checkAndRedirect = async (reference: string) => {
    try {
      // Quick check to see if it's a wallet topup
      const typeResponse = await fetch('/api/payment/check-type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      })

      const typeData = await typeResponse.json()

      // If it's a wallet topup, redirect immediately without verification
      if (typeData.isWalletTopup === true) {
        setIsRedirecting(true)
        // Use window.location for immediate hard redirect (no React router delay)
        window.location.href = '/dashboard/wallet'
        return
      }

      // If it's not a wallet topup, proceed with normal verification
      if (typeData.isWalletTopup === false) {
        verifyPayment(reference)
        return
      }

      // If we can't determine, try verification anyway
      verifyPayment(reference)
    } catch (error) {
      // If check fails, proceed with normal verification
      verifyPayment(reference)
    }
  }

  const verifyPayment = async (reference: string) => {
    try {
      // First, check if this is a wallet topup by trying to verify it as a topup
      // If it fails with "Top-up transaction not found", then it's an order payment
      let response = await fetch('/api/wallet/topup/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      })

      let data = await response.json()

      // If it's a wallet topup (success or already processed), redirect immediately to wallet page
      if (response.ok && data.success) {
        setIsRedirecting(true)
        window.location.href = '/dashboard/wallet'
        return
      }

      // If wallet topup verification failed for any reason, still redirect to wallet page
      // (no error message shown)
      if (response.status !== 404) {
        setIsRedirecting(true)
        window.location.href = '/dashboard/wallet'
        return
      }

      // If it's not a wallet topup (404 means transaction not found), try order verification
      response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      })

      data = await response.json()

      if (data.success) {
        setIsWalletTopup(false)
        setStatus('success')
        setMessage('Payment verified successfully! Your data bundle has been activated.')
        setOrderId(data.data.orderId)
      } else {
        setStatus('error')
        setMessage(data.error || 'Payment verification failed')
      }
    } catch (error) {
      // For any error, try to check if it's a wallet topup
      // If so, redirect to wallet page; otherwise show error for orders
      try {
        const checkResponse = await fetch('/api/wallet/topup/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reference }),
        })
        
        if (checkResponse.status !== 404) {
          // It's a wallet topup, redirect to wallet page
          setIsRedirecting(true)
          window.location.href = '/dashboard/wallet'
        } else {
          // It's an order payment, show error
          setStatus('error')
          setMessage('An error occurred while verifying payment')
        }
      } catch {
        // If we can't determine, assume it's an order and show error
        setStatus('error')
        setMessage('An error occurred while verifying payment')
      }
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-600" />
      case 'error':
        return <XCircle className="h-16 w-16 text-red-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
    }
  }

  // If redirecting for wallet topup, show nothing (or minimal loading)
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className={`text-2xl ${getStatusColor()}`}>
              {status === 'loading' && 'Verifying Payment...'}
              {status === 'success' && 'Payment Successful!'}
              {status === 'error' && 'Payment Failed'}
            </CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'success' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {isWalletTopup 
                    ? 'Your wallet has been credited successfully. You can now use your wallet balance to make purchases.'
                    : 'Your data bundle has been activated and sent to your phone number. You should receive a confirmation SMS shortly.'}
                </AlertDescription>
              </Alert>
            )}

            {status === 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Link href="/dashboard">
                <Button className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              
              {status === 'success' && !isWalletTopup && (
                <Link href="/dashboard/orders">
                  <Button variant="outline" className="w-full">
                    View Order Details
                  </Button>
                </Link>
              )}

              {status === 'success' && isWalletTopup && (
                <Link href="/dashboard/wallet">
                  <Button variant="outline" className="w-full">
                    View Wallet
                  </Button>
                </Link>
              )}

              {status === 'error' && (
                <Link href={isWalletTopup ? "/dashboard/wallet" : "/dashboard/buy-data"}>
                  <Button variant="outline" className="w-full">
                    Try Again
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>}>
      <PaymentCallbackInner />
    </Suspense>
  )
}
