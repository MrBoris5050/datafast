"use client"

import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, CheckCircle, UserPlus, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, Zap, Shield, Globe, Star } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

function SignUpInner() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
        }),
      })

      if (response.ok) {
        try {
          const result = await signIn('credentials', {
            email: formData.email,
            password: formData.password,
            redirect: false,
          })
          if (result?.error) {
            setSuccess(true)
            setTimeout(() => router.push('/auth/signin'), 2000)
          } else {
            router.push('/dashboard')
          }
        } catch {
          setSuccess(true)
          setTimeout(() => router.push('/auth/signin'), 2000)
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const perks = [
    { icon: Zap, label: 'Instant data delivery' },
    { icon: Shield, label: 'Secure & encrypted' },
    { icon: Globe, label: 'All major networks' },
    { icon: Star, label: 'Competitive reseller rates' },
  ]

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your account has been created successfully. Redirecting you to sign in…
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Go to Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[44%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/40 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />

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

        {/* Hero */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Start Reselling<br />
              Data Bundles<br />
              Today
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
              Join thousands of resellers who trust datafast for fast, reliable data bundle purchases across all networks.
            </p>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-2 gap-3">
            {perks.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 bg-white/10 border border-white/15 rounded-xl px-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-sm font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-blue-200 text-sm">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-white font-semibold underline underline-offset-2 hover:text-blue-100 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-12 xl:px-16 bg-gray-50 overflow-y-auto">
        {/* Mobile logo */}
        <div className="flex items-center justify-between mb-8 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden">
              <Image src="/logo.jpg" alt="datafast" width={36} height={36} className="w-full h-full object-contain" priority unoptimized />
            </div>
            <span className="text-xl font-bold text-gray-900">Datafast</span>
          </div>
          <Link href="/auth/signin" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
            Sign in
          </Link>
        </div>

        <div className="w-full max-w-lg mx-auto lg:mx-0">
          {/* Header */}
          <div className="mb-7">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-5 group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1.5">Create your account</h1>
            <p className="text-gray-500 text-base">Get started with datafast in seconds</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="bg-red-50 border border-red-200 rounded-xl">
                  <AlertDescription className="text-red-600 text-sm font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-[18px] w-[18px] text-gray-400" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    required
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="0541234567"
                  />
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-[18px] w-[18px] text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">Confirm Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-[18px] w-[18px] text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 mt-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-200 group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Account
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sign in link */}
          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              href="/auth/signin"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1 group"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    }>
      <SignUpInner />
    </Suspense>
  )
}
