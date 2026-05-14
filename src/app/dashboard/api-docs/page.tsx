'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Key, Code, Webhook, CheckCircle2, XCircle, AlertCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function ApiDocsPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm text-gray-100 font-mono">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        className="absolute top-2 right-2 p-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        title="Copy to clipboard"
      >
        {copied === id ? (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  )

  return (
    // <DashboardLayout title="API Documentation" subtitle="Integrate with datafast programmatically">
    <DashboardLayout title="API Documentation">
      <div className="space-y-6">
        {/* Back Button */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm text-gray-600">Back to Dashboard</span>
        </div>

        {/* Base URL */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Code className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Base URL</p>
                <p className="text-lg font-mono text-gray-900">/api/developer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication Section */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Authentication</CardTitle>
                <CardDescription className="text-gray-600">All API requests require authentication using an API key</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 mb-2">Include your API key in the Authorization header of every request:</p>
              <CodeBlock
                id="auth"
                code={`Authorization: Bearer YOUR_API_KEY`}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Security Note</p>
                  <p>Keep your API keys secure and never expose them in client-side code. Rotate keys regularly for better security.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Purchase Endpoint */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Code className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">POST</Badge>
                    <CardTitle className="text-gray-900">Create Purchase</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600">Purchase data bundle for a phone number</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Endpoint</p>
              <CodeBlock
                id="purchase-endpoint"
                code={`POST /api/developer/purchase`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Request Body</p>
              <CodeBlock
                id="purchase-request"
                code={`{
  "network": "MTN",
  "Phone": "0541234567",
  "Datasize": 1,
  "reference": "optional-ref-123"
}`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Request Parameters</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-semibold text-gray-900">Parameter</th>
                      <th className="text-left p-3 font-semibold text-gray-900">Type</th>
                      <th className="text-left p-3 font-semibold text-gray-900">Required</th>
                      <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-gray-100">
                      <td className="p-3 font-mono text-xs">network</td>
                      <td className="p-3">string</td>
                      <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Yes</Badge></td>
                      <td className="p-3">Network provider (MTN, Airtel, Telecel  )</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-3 font-mono text-xs">Phone</td>
                      <td className="p-3">string</td>
                      <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Yes</Badge></td>
                      <td className="p-3">Phone number to purchase data for</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-3 font-mono text-xs">Datasize</td>
                      <td className="p-3">number</td>
                      <td className="p-3"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Yes</Badge></td>
                      <td className="p-3">Data size in GB (e.g., 1 for 1GB)</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-3 font-mono text-xs">reference</td>
                      <td className="p-3">string</td>
                      <td className="p-3"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">No</Badge></td>
                      <td className="p-3">Optional custom reference for tracking</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Success Response (200)</p>
              <CodeBlock
                id="purchase-response"
                code={`{
  "success": true,
  "data": {
    "order": {
      "reference": "api_abc123",
      "status": "PROCESSING",
      "amount": 10.50,
      "phone": "0541234567",
      "providerReference": "DH123456",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "plan": {
        "id": "plan_id",
        "name": "1GB Data",
        "dataAmountGB": "1.00",
        "network": "MTN"
      }
    },
    "currentBalance": 989.50,
    "message": "Order is being processed."
  }
}`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Error Responses</p>
              <div className="space-y-3">
                <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-900">400 - Bad Request</span>
                  </div>
                  <CodeBlock
                    id="purchase-error-400"
                    code={`{
  "error": "Missing network, Phone, or Datasize"
}`}
                  />
                </div>
                <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-900">401 - Unauthorized</span>
                  </div>
                  <CodeBlock
                    id="purchase-error-401"
                    code={`{
  "error": "Unauthorized"
}`}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Get Order Status Endpoint */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Code className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">GET</Badge>
                  <CardTitle className="text-gray-900">Get Order Status</CardTitle>
                </div>
                <CardDescription className="text-gray-600">Retrieve the status of an order by reference</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Endpoint</p>
              <CodeBlock
                id="status-endpoint"
                code={`GET /api/developer/orders/{reference}`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Path Parameters</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-semibold text-gray-900">Parameter</th>
                      <th className="text-left p-3 font-semibold text-gray-900">Type</th>
                      <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-gray-100">
                      <td className="p-3 font-mono text-xs">reference</td>
                      <td className="p-3">string</td>
                      <td className="p-3">Order reference returned from purchase endpoint</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Success Response (200)</p>
              <CodeBlock
                id="status-response"
                code={`{
  "success": true,
  "data": {
    "reference": "api_abc123",
    "status": "COMPLETED",
    "phone": "0541234567",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:05:00.000Z",
    "plan": {
      "dataAmountGB": "1GB",
      "network": "MTN"
    }
  }
}`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Order Status Values</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">PENDING</Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">PROCESSING</Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">COMPLETED</Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">FAILED</Badge>
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">CANCELLED</Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Error Response (404)</p>
              <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                <CodeBlock
                  id="status-error"
                  code={`{
  "error": "Order not found"
}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Get Balance Endpoint */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Code className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">GET</Badge>
                  <CardTitle className="text-gray-900">Get Balance</CardTitle>
                </div>
                <CardDescription className="text-gray-600">Retrieve your current wallet balance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Endpoint</p>
              <CodeBlock
                id="balance-endpoint"
                code={`GET /api/developer/balance`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Success Response (200)</p>
              <CodeBlock
                id="balance-response"
                code={`{
  "success": true,
  "data": {
    "balance": 1000.00,
    "currency": "GHS"
  }
}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Webhooks Section */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Webhook className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Webhooks</CardTitle>
                <CardDescription className="text-gray-600">Receive real-time notifications about order status changes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 mb-3">
                We will send webhook events to your configured URL when order status changes occur. 
                Always verify webhook signatures using the shared secret for security.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Webhook Events</p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">order.processing</span>
                    <p className="text-xs text-gray-600">Order has started processing</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">order.completed</span>
                    <p className="text-xs text-gray-600">Order has been successfully completed</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">order.failed</span>
                    <p className="text-xs text-gray-600">Order processing has failed</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Webhook Payload Example</p>
              <CodeBlock
                id="webhook-payload"
                code={`{
  "event": "order.completed",
  "data": {
    "reference": "api_abc123",
    "status": "COMPLETED",
    "phone": "0541234567",
    "amount": 10.50
  },
  "timestamp": "2024-01-01T00:05:00.000Z"
}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits & Best Practices */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Best Practices</CardTitle>
                <CardDescription className="text-gray-600">Tips for integrating with our API</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Always handle errors gracefully and implement retry logic for failed requests</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use webhooks to receive real-time updates instead of polling the order status endpoint</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Store order references in your database for tracking and reconciliation</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Verify webhook signatures to ensure requests are from datafast</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Monitor your wallet balance before making purchases to avoid failed transactions</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
