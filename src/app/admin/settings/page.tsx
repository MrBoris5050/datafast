'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Save,
  RefreshCw,
  Bell,
  Globe,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PlatformSettings {
  general: {
    platformName: string
    platformDescription: string
    supportEmail: string
    supportPhone: string
    supportAddress: string
    timezone: string
    currency: string
    language: string
  }
  features: {
    userRegistration: boolean
    emailNotifications: boolean
    smsNotifications: boolean
    maintenanceMode: boolean
    apiAccess: boolean
  }
  payment: {
    paystackPublicKey: string
    paystackSecretKey: string
    paystackWebhookSecret: string
    enableTestMode: boolean
  }
  notifications: {
    emailProvider: string
    smsProvider: string
    orderNotifications: boolean
    userNotifications: boolean
    systemNotifications: boolean
  }
}

export default function AdminSettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<PlatformSettings>({
    general: {
      platformName: 'datafast',
      platformDescription: 'Premium data purchase platform for all Ghanaian networks',
      supportEmail: 'support@datafastgh.com',
      supportPhone: '0541234567',
      supportAddress: 'Accra, Ghana',
      timezone: 'Africa/Accra',
      currency: 'GHS',
      language: 'en'
    },
    features: {
      userRegistration: true,
      emailNotifications: true,
      smsNotifications: true,
      maintenanceMode: false,
      apiAccess: true
    },
    payment: {
      paystackPublicKey: 'pk_test_...',
      paystackSecretKey: 'sk_test_...',
      paystackWebhookSecret: 'whsec_...',
      enableTestMode: true
    },
    notifications: {
      emailProvider: 'smtp',
      smsProvider: 'twilio',
      orderNotifications: true,
      userNotifications: true,
      systemNotifications: true
    }
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // Agent Upgrade Settings (backed by DB)
  const [agentUpgradeEnabled, setAgentUpgradeEnabled] = useState(false)
  const [agentUpgradePrice, setAgentUpgradePrice] = useState('')
  const [agentUpgradeLoading, setAgentUpgradeLoading] = useState(true)
  const [agentUpgradeSaving, setAgentUpgradeSaving] = useState(false)
  const [agentUpgradeSaved, setAgentUpgradeSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings/agent-upgrade')
      .then(res => res.json())
      .then(data => {
        setAgentUpgradeEnabled(data.enabled ?? false)
        setAgentUpgradePrice(data.price != null ? String(data.price) : '')
      })
      .finally(() => setAgentUpgradeLoading(false))
  }, [])

  const handleSaveAgentUpgrade = async () => {
    setAgentUpgradeSaving(true)
    setAgentUpgradeSaved(false)
    try {
      const res = await fetch('/api/admin/settings/agent-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: agentUpgradeEnabled, price: agentUpgradePrice })
      })
      if (res.ok) {
        setAgentUpgradeSaved(true)
        setTimeout(() => setAgentUpgradeSaved(false), 3000)
      }
    } finally {
      setAgentUpgradeSaving(false)
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'features', label: 'Features', icon: Settings },
    // { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'agent-upgrade', label: 'Agent Upgrade', icon: TrendingUp }
  ]

  const handleSaveSettings = async () => {
    try {
      setLoading(true)
      // API call to save settings
      console.log('Saving settings:', settings)
      // await fetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) })
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success message
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Error saving settings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      // Reset to default settings
      window.location.reload()
    }
  }

  const updateSetting = (section: keyof PlatformSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Platform Settings</h1>
              <p className="text-sm sm:text-base text-gray-400">Configure system settings and preferences</p>
            </div>
          </div>
        </div>
        <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Settings className="h-3 w-3" />
              <span>Configuration</span>
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleResetSettings} className="border-gray-200 text-gray-300 hover:bg-gray-100">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveSettings} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <Card className="lg:col-span-1 bg-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-500'
                          : 'text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {activeTab === 'general' && (
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">General Settings</CardTitle>
                  <CardDescription className="text-gray-400">
                    Basic platform information and configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="platformName" className="text-gray-900">Platform Name</Label>
                      <Input
                        id="platformName"
                        value={settings.general.platformName}
                        onChange={(e) => updateSetting('general', 'platformName', e.target.value)}
                        className="mt-1 bg-gray-100 border-gray-200 text-gray-900"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency" className="text-gray-900">Currency</Label>
                      <Select value={settings.general.currency} onValueChange={(value) => updateSetting('general', 'currency', value)}>
                        <SelectTrigger className="mt-1 bg-gray-100 border-gray-200 text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-100 border-gray-200">
                          <SelectItem value="GHS" className="text-gray-900 hover:bg-gray-100">Ghana Cedi (GHS)</SelectItem>
                          <SelectItem value="USD" className="text-gray-900 hover:bg-gray-100">US Dollar (USD)</SelectItem>
                          <SelectItem value="EUR" className="text-gray-900 hover:bg-gray-100">Euro (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="platformDescription" className="text-gray-900">Platform Description</Label>
                    <Textarea
                      id="platformDescription"
                      value={settings.general.platformDescription}
                      onChange={(e) => updateSetting('general', 'platformDescription', e.target.value)}
                      className="mt-1 bg-gray-100 border-gray-200 text-gray-900"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="supportEmail" className="text-gray-900">Support Email</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="supportEmail"
                          type="email"
                          value={settings.general.supportEmail}
                          onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)}
                          className="pl-10 bg-gray-100 border-gray-200 text-gray-900"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="supportPhone" className="text-gray-900">Support Phone</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="supportPhone"
                          type="tel"
                          value={settings.general.supportPhone}
                          onChange={(e) => updateSetting('general', 'supportPhone', e.target.value)}
                          className="pl-10 bg-gray-100 border-gray-200 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="supportAddress" className="text-gray-900">Support Address</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="supportAddress"
                        value={settings.general.supportAddress}
                        onChange={(e) => updateSetting('general', 'supportAddress', e.target.value)}
                        className="pl-10 bg-gray-100 border-gray-200 text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="timezone" className="text-gray-900">Timezone</Label>
                      <Select value={settings.general.timezone} onValueChange={(value) => updateSetting('general', 'timezone', value)}>
                        <SelectTrigger className="mt-1 bg-gray-100 border-gray-200 text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-100 border-gray-200">
                          <SelectItem value="Africa/Accra" className="text-gray-900 hover:bg-gray-100">Africa/Accra (GMT+0)</SelectItem>
                          <SelectItem value="Africa/Lagos" className="text-gray-900 hover:bg-gray-100">Africa/Lagos (GMT+1)</SelectItem>
                          <SelectItem value="UTC" className="text-gray-900 hover:bg-gray-100">UTC (GMT+0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="language" className="text-gray-900">Language</Label>
                      <Select value={settings.general.language} onValueChange={(value) => updateSetting('general', 'language', value)}>
                        <SelectTrigger className="mt-1 bg-gray-100 border-gray-200 text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-100 border-gray-200">
                          <SelectItem value="en" className="text-gray-900 hover:bg-gray-100">English</SelectItem>
                          <SelectItem value="fr" className="text-gray-900 hover:bg-gray-100">French</SelectItem>
                          <SelectItem value="es" className="text-gray-900 hover:bg-gray-100">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'features' && (
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Feature Settings</CardTitle>
                  <CardDescription className="text-gray-400">
                    Enable or disable platform features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="userRegistration" className="text-gray-900">User Registration</Label>
                        <p className="text-sm text-gray-400">Allow new users to register accounts</p>
                      </div>
                      <Switch
                        id="userRegistration"
                        checked={settings.features.userRegistration}
                        onCheckedChange={(checked) => updateSetting('features', 'userRegistration', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="emailNotifications" className="text-gray-900">Email Notifications</Label>
                        <p className="text-sm text-gray-400">Send email notifications to users</p>
                      </div>
                      <Switch
                        id="emailNotifications"
                        checked={settings.features.emailNotifications}
                        onCheckedChange={(checked) => updateSetting('features', 'emailNotifications', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="smsNotifications" className="text-gray-900">SMS Notifications</Label>
                        <p className="text-sm text-gray-400">Send SMS notifications to users</p>
                      </div>
                      <Switch
                        id="smsNotifications"
                        checked={settings.features.smsNotifications}
                        onCheckedChange={(checked) => updateSetting('features', 'smsNotifications', checked)}
                      />
                    </div>

                    {/* <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="maintenanceMode" className="text-gray-900">Maintenance Mode</Label>
                        <p className="text-sm text-gray-400">Put the platform in maintenance mode</p>
                      </div>
                      <Switch
                        id="maintenanceMode"
                        checked={settings.features.maintenanceMode}
                        onCheckedChange={(checked) => updateSetting('features', 'maintenanceMode', checked)}
                      />
                    </div> */}

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="apiAccess" className="text-gray-900">API Access</Label>
                        <p className="text-sm text-gray-400">Enable API access for third-party integrations</p>
                      </div>
                      <Switch
                        id="apiAccess"
                        checked={settings.features.apiAccess}
                        onCheckedChange={(checked) => updateSetting('features', 'apiAccess', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'payment' && (
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Payment Settings</CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure payment gateway settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="paystackPublicKey" className="text-gray-900">Paystack Public Key</Label>
                      <Input
                        id="paystackPublicKey"
                        value={settings.payment.paystackPublicKey}
                        onChange={(e) => updateSetting('payment', 'paystackPublicKey', e.target.value)}
                        className="mt-1 bg-gray-100 border-gray-200 text-gray-900"
                        type="password"
                      />
                    </div>

                    <div>
                      <Label htmlFor="paystackSecretKey" className="text-gray-900">Paystack Secret Key</Label>
                      <Input
                        id="paystackSecretKey"
                        value={settings.payment.paystackSecretKey}
                        onChange={(e) => updateSetting('payment', 'paystackSecretKey', e.target.value)}
                        className="mt-1 bg-gray-100 border-gray-200 text-gray-900"
                        type="password"
                      />
                    </div>

                    <div>
                      <Label htmlFor="paystackWebhookSecret" className="text-gray-900">Paystack Webhook Secret</Label>
                      <Input
                        id="paystackWebhookSecret"
                        value={settings.payment.paystackWebhookSecret}
                        onChange={(e) => updateSetting('payment', 'paystackWebhookSecret', e.target.value)}
                        className="mt-1 bg-gray-100 border-gray-200 text-gray-900"
                        type="password"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enableTestMode" className="text-gray-900">Test Mode</Label>
                        <p className="text-sm text-gray-400">Enable test mode for payment processing</p>
                      </div>
                      <Switch
                        id="enableTestMode"
                        checked={settings.payment.enableTestMode}
                        onCheckedChange={(checked) => updateSetting('payment', 'enableTestMode', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Notification Settings</CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure notification providers and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="emailProvider" className="text-gray-900">Email Provider</Label>
                      <Select value={settings.notifications.emailProvider} onValueChange={(value) => updateSetting('notifications', 'emailProvider', value)}>
                        <SelectTrigger className="mt-1 bg-gray-100 border-gray-200 text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-100 border-gray-200">
                          <SelectItem value="smtp" className="text-gray-900 hover:bg-gray-100">SMTP</SelectItem>
                          <SelectItem value="sendgrid" className="text-gray-900 hover:bg-gray-100">SendGrid</SelectItem>
                          <SelectItem value="mailgun" className="text-gray-900 hover:bg-gray-100">Mailgun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="smsProvider" className="text-gray-900">SMS Provider</Label>
                      <Select value={settings.notifications.smsProvider} onValueChange={(value) => updateSetting('notifications', 'smsProvider', value)}>
                        <SelectTrigger className="mt-1 bg-gray-100 border-gray-200 text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-100 border-gray-200">
                          <SelectItem value="twilio" className="text-gray-900 hover:bg-gray-100">Twilio</SelectItem>
                          <SelectItem value="africasTalking" className="text-gray-900 hover:bg-gray-100">Africa's Talking</SelectItem>
                          <SelectItem value="nexmo" className="text-gray-900 hover:bg-gray-100">Nexmo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div> */}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="orderNotifications" className="text-gray-900">Order Notifications</Label>
                        <p className="text-sm text-gray-400">Send notifications for order updates</p>
                      </div>
                      <Switch
                        id="orderNotifications"
                        checked={settings.notifications.orderNotifications}
                        onCheckedChange={(checked) => updateSetting('notifications', 'orderNotifications', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="userNotifications" className="text-gray-900">User Notifications</Label>
                        <p className="text-sm text-gray-400">Send notifications for user activities</p>
                      </div>
                      <Switch
                        id="userNotifications"
                        checked={settings.notifications.userNotifications}
                        onCheckedChange={(checked) => updateSetting('notifications', 'userNotifications', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="systemNotifications" className="text-gray-900">System Notifications</Label>
                        <p className="text-sm text-gray-400">Send notifications for system events</p>
                      </div>
                      <Switch
                        id="systemNotifications"
                        checked={settings.notifications.systemNotifications}
                        onCheckedChange={(checked) => updateSetting('notifications', 'systemNotifications', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'agent-upgrade' && (
              <Card className="bg-gray-100 border-gray-200">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-gray-900">Agent Upgrade Settings</CardTitle>
                  </div>
                  <CardDescription className="text-gray-400">
                    Configure the one-time fee users pay to upgrade from Customer to Agent role. When enabled, a &quot;Become an Agent&quot; option appears in the user menu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {agentUpgradeLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading settings...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200">
                        <div>
                          <Label htmlFor="agentUpgradeEnabled" className="text-gray-900 font-medium">Enable Agent Upgrade</Label>
                          <p className="text-sm text-gray-400 mt-0.5">
                            Allow customers to self-upgrade to Agent by paying a fee from their wallet.
                          </p>
                        </div>
                        <Switch
                          id="agentUpgradeEnabled"
                          checked={agentUpgradeEnabled}
                          onCheckedChange={setAgentUpgradeEnabled}
                        />
                      </div>

                      <div className={`space-y-2 transition-opacity ${agentUpgradeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <Label htmlFor="agentUpgradePrice" className="text-gray-900">Upgrade Fee (GHS)</Label>
                        <p className="text-xs text-gray-400">
                          This amount will be deducted from the user&apos;s wallet when they upgrade.
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">GHS</span>
                          <Input
                            id="agentUpgradePrice"
                            type="number"
                            min="1"
                            step="0.01"
                            value={agentUpgradePrice}
                            onChange={(e) => setAgentUpgradePrice(e.target.value)}
                            className="pl-12 bg-white border-gray-200 text-gray-900 text-lg font-semibold"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleSaveAgentUpgrade}
                          disabled={agentUpgradeSaving || (agentUpgradeEnabled && (!agentUpgradePrice || parseFloat(agentUpgradePrice) <= 0))}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {agentUpgradeSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Agent Upgrade Settings
                            </>
                          )}
                        </Button>
                        {agentUpgradeSaved && (
                          <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            Saved successfully
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 leading-relaxed">
                        <strong>How it works:</strong> When enabled, a &quot;Become an Agent&quot; link appears in the user sidebar for all Customer accounts. Users can click it, review agent benefits, and pay the upgrade fee from their wallet. Their role automatically changes to <strong>AGENT</strong> upon successful payment, granting them access to agent pricing on all data bundles.
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Additional tabs can be added here in the future */}
          </div>
        </div>
      </div>
      </div>
    </AdminLayout>
  )
}
