'use client'

import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit,
  Save,
  X,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Shield
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    address: ''
  })

  // Change Password States
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)

  // Fetch user profile data
  useEffect(() => {
    if (session?.user?.id) {
      setIsLoading(true)
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.createdAt) {
            setUserCreatedAt(data.createdAt)
          }
          if (data.name) {
            setFormData(prev => ({
              ...prev,
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              address: data.address || ''
            }))
          }
        })
        .catch(error => {
          console.error('Error fetching profile:', error)
          toast({
            title: "Error",
            description: "Failed to load profile data",
            variant: "destructive"
          })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [session?.user?.id, toast])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be signed in to update your profile",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      // Update session to reflect changes
      await updateSession({
        ...session,
        user: {
          ...session.user,
          name: data.user.name
        }
      })

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })

      setIsEditing(false)
    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
    // Reload original data from API
    if (session?.user?.id) {
      try {
        const response = await fetch('/api/user/profile')
        const data = await response.json()
        if (response.ok) {
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || ''
          })
        }
      } catch (error) {
        console.error('Error reloading profile:', error)
      }
    }
    setIsEditing(false)
  }

  const handlePasswordChange = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be signed in to change your password",
        variant: "destructive"
      })
      return
    }

    // Validate
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "All password fields are required",
        variant: "destructive"
      })
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      })
      return
    }

    setIsPasswordSaving(true)
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      })

      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setIsChangingPassword(false)
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const handlePasswordCancel = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    setIsChangingPassword(false)
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const formatMemberSince = (dateString: string | null) => {
    if (!dateString) return 'January 2024'
    
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    })
  }

  const formatMemberSinceShort = (dateString: string | null) => {
    if (!dateString) return 'Jan 2024'
    
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    })
  }

  const getTimeSinceMember = (dateString: string | null) => {
    if (!dateString) return '3 months ago'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) {
      return `${diffDays} days ago`
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''} ago`
    } else {
      const years = Math.floor(diffDays / 365)
      return `${years} year${years > 1 ? 's' : ''} ago`
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="destructive">Admin</Badge>
              case 'AGENT':
        return <Badge variant="default" className="bg-blue-50 text-blue-600 border-0">Agent</Badge>
      case 'WHOLESALER':
        return <Badge variant="default" className="bg-purple-50 text-purple-600 border-0">Wholesaler</Badge>
      case 'DEALER':
        return <Badge variant="default" className="bg-emerald-50 text-emerald-600 border-0">Dealer</Badge>
      case 'CUSTOMER':
        return <Badge variant="outline">Customer</Badge>
      default:
        return <Badge variant="outline">User</Badge>
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <DashboardLayout
      title="Profile Settings"
      // subtitle="Manage your account information and preferences"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 mx-auto sm:mx-0">
                <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                <AvatarFallback className="bg-blue-50 text-blue-600 text-xl sm:text-2xl">
                  {getInitials(session?.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {session?.user?.name || 'User'}
                  </h2>
                  <div className="flex justify-center sm:justify-start">
                    {getRoleBadge(session?.user?.role || 'CUSTOMER')}
                  </div>
                </div>
                <p className="text-gray-500 mt-1 text-sm sm:text-base">{session?.user?.email}</p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Member since {formatMemberSince(userCreatedAt)}</p>
              </div>
              <div className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                  <span className="sm:hidden">{isEditing ? 'Cancel' : 'Edit'}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Profile Form */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-gray-900 text-lg sm:text-xl">Personal Information</CardTitle>
            <CardDescription className="text-gray-500 text-sm sm:text-base">
              Update your personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 text-sm">Loading profile...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="name" className="text-gray-700">Full Name</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditing || isSaving}
                      className="pl-10"
                    />
                  </div>
                </div>

              <div>
                <Label htmlFor="email" className="text-gray-700">Email Address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={true}
                    className="pl-10 bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>

                <div>
                  <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing || isSaving}
                      className="pl-10"
                      placeholder="e.g., 0541234567"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-gray-700">Address</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      disabled={!isEditing || isSaving}
                      className="pl-10"
                      placeholder="e.g., Accra, Ghana"
                    />
                  </div>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                <Button 
                  variant="outline" 
                  onClick={handleCancel} 
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Security
                </CardTitle>
                <CardDescription className="text-gray-500 text-sm sm:text-base">
                  Manage your password and account security
                </CardDescription>
              </div>
              {!isChangingPassword && (
                <Button
                  variant="outline"
                  onClick={() => setIsChangingPassword(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Button>
              )}
            </div>
          </CardHeader>
          
          {isChangingPassword && (
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                {/* Current Password */}
                <div>
                  <Label htmlFor="currentPassword" className="text-gray-700">Current Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      disabled={isPasswordSaving}
                      className="pl-10 pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword" className="text-gray-700">New Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      disabled={isPasswordSaving}
                      className="pl-10 pr-10"
                      placeholder="Enter new password (min. 6 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <Label htmlFor="confirmPassword" className="text-gray-700">Confirm New Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      disabled={isPasswordSaving}
                      className="pl-10 pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              {/* Password Requirements */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li className={`flex items-center gap-2 ${passwordData.newPassword.length >= 6 ? 'text-emerald-600' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordData.newPassword.length >= 6 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                    At least 6 characters
                  </li>
                  <li className={`flex items-center gap-2 ${passwordData.newPassword && passwordData.newPassword === passwordData.confirmPassword ? 'text-emerald-600' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordData.newPassword && passwordData.newPassword === passwordData.confirmPassword ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                    Passwords match
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                <Button 
                  variant="outline" 
                  onClick={handlePasswordCancel} 
                  disabled={isPasswordSaving}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handlePasswordChange} 
                  disabled={isPasswordSaving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 6}
                  className="w-full sm:w-auto"
                >
                  {isPasswordSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Update Password
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Account Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">12</div>
              <p className="text-xs text-gray-400">+2 this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium text-gray-600">Total Spent</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">₵450</div>
              <p className="text-xs text-gray-400">+12% from last month</p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium text-gray-600">Member Since</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{formatMemberSinceShort(userCreatedAt)}</div>
              <p className="text-xs text-gray-400">{getTimeSinceMember(userCreatedAt)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
