"use client"

import { useState, Suspense, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, LogIn, Mail, Lock, ArrowRight, Eye, EyeOff, Phone, KeyRound, Zap, Shield, Globe, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

function SignInInner() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  // Forgot Password States
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetStep, setResetStep] = useState<'identifier' | 'code' | 'password'>('identifier')
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [sentTo, setSentTo] = useState<string[]>([])

  const { status } = useSession()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl || '/dashboard')
    }
  }, [status, router, callbackUrl])

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const isEmail = identifier.includes('@')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: identifier,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email/phone or password')
      } else {
        router.push(callbackUrl || '/dashboard')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      if (resetStep === 'identifier') {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: resetIdentifier })
        })
        const data = await response.json()
        if (response.ok) {
          setResetSuccess(data.message || 'Reset code sent successfully')
          setSentTo(data.sentTo || [])
          setResetStep('code')
        } else {
          setResetError(data.error || 'Failed to send reset code')
        }
      } else if (resetStep === 'code') {
        const response = await fetch('/api/auth/verify-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: resetIdentifier, code: resetCode })
        })
        const data = await response.json()
        if (response.ok) {
          setResetSuccess('Code verified successfully')
          setResetStep('password')
        } else {
          setResetError(data.error || 'Invalid reset code')
        }
      } else if (resetStep === 'password') {
        if (newPassword !== confirmPassword) {
          setResetError('Passwords do not match')
          return
        }
        if (newPassword.length < 6) {
          setResetError('Password must be at least 6 characters')
          return
        }
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: resetIdentifier, code: resetCode, newPassword })
        })
        const data = await response.json()
        if (response.ok) {
          setResetSuccess('Password reset successfully! You can now sign in with your new password.')
          setTimeout(() => {
            setIsForgotPasswordOpen(false)
            resetForgotPasswordForm()
          }, 2000)
        } else {
          setResetError(data.error || 'Failed to reset password')
        }
      }
    } catch {
      setResetError('An error occurred. Please try again.')
    } finally {
      setIsResetLoading(false)
    }
  }

  const resetForgotPasswordForm = () => {
    setResetIdentifier('')
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    setResetStep('identifier')
    setResetError('')
    setResetSuccess('')
    setSentTo([])
  }

  const features = [
    { icon: Zap, title: 'Instant Delivery', desc: 'Data delivered in seconds across all networks' },
    { icon: Shield, title: 'Secure Payments', desc: 'Your transactions are fully encrypted and protected' },
    { icon: Globe, title: 'All Networks', desc: 'MTN, AirtelTigo, Telecel and more covered' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/40 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
            <Image
              src="/logo.jpg"
              alt="datafast"
              width={36}
              height={36}
              className="w-full h-full object-contain"
              priority
              unoptimized
            />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Datafast</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Ghana&apos;s Fastest<br />
              Data Reseller<br />
              Platform
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
              Buy and resell data bundles instantly. Power your business with our reliable API and real-time dashboard.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-blue-200 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex -space-x-2">
            {['bg-emerald-400', 'bg-sky-400', 'bg-violet-400'].map((c, i) => (
              <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-blue-700 flex items-center justify-center`}>
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            ))}
          </div>
          <p className="text-blue-100 text-sm">Trusted by thousands of resellers</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 xl:px-16 bg-gray-50">
        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden">
            <Image src="/logo.jpg" alt="datafast" width={36} height={36} className="w-full h-full object-contain" priority unoptimized />
          </div>
          <span className="text-xl font-bold text-gray-900">Datafast</span>
        </div>

        <div className="w-full max-w-md mx-auto lg:mx-0">
          {/* Header */}
          <div className="mb-8">
            {/* <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome back</h1> */}
            <p className="text-gray-500 text-base">Sign in to your account to continue</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert className="bg-red-50 border border-red-200 rounded-xl">
                  <AlertDescription className="text-red-600 text-sm font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {/* Identifier */}
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-sm font-semibold text-gray-700">
                  Email or Phone Number
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    {isEmail ? (
                      <Mail className="h-4.5 w-4.5 h-[18px] w-[18px] text-gray-400" />
                    ) : (
                      <Phone className="h-[18px] w-[18px] text-gray-400" />
                    )}
                  </div>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Email or phone number"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-11 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-200 group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1 group"
            >
              Create one
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-white border-gray-200 text-gray-900 [&>button]:text-gray-500 [&>button]:hover:text-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-50 rounded-lg">
                <KeyRound className="h-4 w-4 text-blue-600" />
              </div>
              Reset Password
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {resetStep === 'identifier' && 'Enter your email or phone number to receive a reset code'}
              {resetStep === 'code' && 'Enter the verification code sent to your email and/or phone'}
              {resetStep === 'password' && 'Create a new password for your account'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            {resetError && (
              <Alert className="bg-red-50 border border-red-200 rounded-xl">
                <AlertDescription className="text-red-600 text-sm">{resetError}</AlertDescription>
              </Alert>
            )}

            {resetSuccess && (
              <Alert className="bg-green-50 border border-green-200 rounded-xl">
                <AlertDescription className="text-green-700 text-sm">{resetSuccess}</AlertDescription>
              </Alert>
            )}

            {resetStep === 'identifier' && (
              <div className="space-y-1.5">
                <Label htmlFor="resetIdentifier" className="text-sm font-semibold text-gray-700">
                  Email or Phone Number
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <input
                    id="resetIdentifier"
                    type="text"
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="Enter your email or phone number"
                    required
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  The reset code will be sent to both your email and phone if available
                </p>
              </div>
            )}

            {resetStep === 'code' && (
              <div className="space-y-1.5">
                <Label htmlFor="resetCode" className="text-sm font-semibold text-gray-700">
                  Verification Code
                </Label>
                <input
                  id="resetCode"
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full h-12 rounded-xl border border-gray-300 bg-white text-gray-900 text-center text-xl font-bold tracking-[0.4em] placeholder:text-gray-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-400 text-center">
                  {sentTo.length > 0 ? (
                    <>Code sent to: <span className="font-semibold text-gray-600">{sentTo.join(' and ')}</span></>
                  ) : (
                    'Enter the code sent to your email and/or phone'
                  )}
                </p>
              </div>
            )}

            {resetStep === 'password' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-gray-700">New Password</Label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength={6}
                    required
                    className="w-full px-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">Confirm Password</Label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                    className="w-full px-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </>
            )}

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsForgotPasswordOpen(false); resetForgotPasswordForm() }}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <button
                type="submit"
                disabled={isResetLoading}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {isResetLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                ) : (
                  <>
                    {resetStep === 'identifier' && 'Send Code'}
                    {resetStep === 'code' && 'Verify Code'}
                    {resetStep === 'password' && 'Reset Password'}
                  </>
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    }>
      <SignInInner />
    </Suspense>
  )
}
