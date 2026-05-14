/**
 * Notification fallback system
 * Ensures users are notified through multiple channels
 */

import { prisma } from '@/lib/db'
import { sendSmsViaArkesel } from './arkesel'
import { sendEmail } from './email'

export type NotificationType = 
  | 'ORDER_SUCCESS' 
  | 'ORDER_FAILED' 
  | 'ORDER_PROCESSING'
  | 'WALLET_CREDIT'
  | 'WALLET_DEBIT'
  | 'GENERAL'

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, any>
  // Optional direct contact info (if user not in DB or for order phone)
  phone?: string
  email?: string
}

export interface NotificationResult {
  sms: { success: boolean; error?: string }
  email: { success: boolean; error?: string }
  inApp: { success: boolean; error?: string }
}

/**
 * Send notification through all available channels
 * Will attempt all channels and report results for each
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const result: NotificationResult = {
    sms: { success: false },
    email: { success: false },
    inApp: { success: false }
  }

  // Get user contact info if not provided
  let phone = payload.phone
  let email = payload.email

  if (!phone || !email) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { phone: true, email: true }
      })
      if (user) {
        phone = phone || user.phone || undefined
        email = email || user.email
      }
    } catch (error) {
      console.error('[Notifications] Error fetching user:', error)
    }
  }

  // Run all notification attempts in parallel
  const promises: Promise<void>[] = []

  // 1. SMS notification
  if (phone) {
    promises.push(
      sendSmsNotification(phone, payload.message)
        .then(() => { result.sms = { success: true } })
        .catch((e) => { result.sms = { success: false, error: e?.message || String(e) } })
    )
  }

  // 2. Email notification
  if (email) {
    promises.push(
      sendEmailNotification(email, payload.title, payload.message, payload.type)
        .then(() => { result.email = { success: true } })
        .catch((e) => { result.email = { success: false, error: e?.message || String(e) } })
    )
  }

  // 3. In-app notification (always attempt)
  promises.push(
    createInAppNotification(payload)
      .then(() => { result.inApp = { success: true } })
      .catch((e) => { result.inApp = { success: false, error: e?.message || String(e) } })
  )

  await Promise.allSettled(promises)

  // Log notification results
  console.log(`[Notifications] Results for user ${payload.userId}:`, {
    type: payload.type,
    sms: result.sms.success ? 'sent' : `failed: ${result.sms.error}`,
    email: result.email.success ? 'sent' : `failed: ${result.email.error}`,
    inApp: result.inApp.success ? 'created' : `failed: ${result.inApp.error}`
  })

  return result
}

/**
 * Send order completion notification
 */
export async function notifyOrderCompleted(
  userId: string,
  orderDetails: {
    reference: string
    planName: string
    phone: string
    amount: number
  }
): Promise<NotificationResult> {
  const message = `Data purchase successful: ${orderDetails.planName} for ${orderDetails.phone}. Amount: GHS ${orderDetails.amount.toFixed(2)}. Ref: ${orderDetails.reference}`
  
  return sendNotification({
    userId,
    type: 'ORDER_SUCCESS',
    title: 'Data Purchase Successful',
    message,
    phone: orderDetails.phone, // Also send to order phone number
    metadata: orderDetails
  })
}

/**
 * Send order failure notification
 */
export async function notifyOrderFailed(
  userId: string,
  orderDetails: {
    reference: string
    planName: string
    phone: string
    amount: number
    reason?: string
  }
): Promise<NotificationResult> {
  const message = `Data purchase failed: ${orderDetails.planName}. Refund of GHS ${orderDetails.amount.toFixed(2)} has been credited to your wallet. Ref: ${orderDetails.reference}`
  
  return sendNotification({
    userId,
    type: 'ORDER_FAILED',
    title: 'Data Purchase Failed - Refunded',
    message,
    phone: orderDetails.phone,
    metadata: { ...orderDetails, refunded: true }
  })
}

/**
 * Send order processing notification
 */
export async function notifyOrderProcessing(
  userId: string,
  orderDetails: {
    reference: string
    planName: string
    phone: string
  }
): Promise<NotificationResult> {
  const message = `Your order for ${orderDetails.planName} is being processed. Ref: ${orderDetails.reference}. You will be notified when complete.`
  
  return sendNotification({
    userId,
    type: 'ORDER_PROCESSING',
    title: 'Order Processing',
    message,
    metadata: orderDetails
  })
}

// Private helper functions

async function sendSmsNotification(phone: string, message: string): Promise<void> {
  const result = await sendSmsViaArkesel({ to: phone, message })
  if (!result.ok) {
    throw new Error(result.error || 'SMS send failed')
  }
}

async function sendEmailNotification(
  email: string, 
  subject: string, 
  message: string,
  type: NotificationType
): Promise<void> {
  // Format email based on notification type
  const html = formatEmailHtml(subject, message, type)
  
  await sendEmail({
    to: email,
    subject,
    text: message,
    html
  })
}

async function createInAppNotification(payload: NotificationPayload): Promise<void> {
  // Check if Notification model exists before creating
  // This handles the case where the schema might not have the Notification model yet
  try {
    await (prisma as any).notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        read: false
      }
    })
  } catch (error: any) {
    // If Notification model doesn't exist, log but don't fail
    if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
      console.log('[Notifications] Notification model not available, skipping in-app notification')
      return
    }
    throw error
  }
}

function formatEmailHtml(title: string, message: string, type: NotificationType): string {
  const statusColor = type === 'ORDER_SUCCESS' ? '#22c55e' 
    : type === 'ORDER_FAILED' ? '#ef4444' 
    : '#3b82f6'
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">${message}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          This is an automated notification from your data service provider.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Get unread notifications count for a user
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    return await (prisma as any).notification.count({
      where: { userId, read: false }
    })
  } catch {
    return 0
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string, 
  options: { limit?: number; unreadOnly?: boolean } = {}
) {
  try {
    return await (prisma as any).notification.findMany({
      where: { 
        userId,
        ...(options.unreadOnly && { read: false })
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50
    })
  } catch {
    return []
  }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(userId: string, notificationIds?: string[]): Promise<void> {
  try {
    if (notificationIds && notificationIds.length > 0) {
      await (prisma as any).notification.updateMany({
        where: { 
          userId, 
          id: { in: notificationIds } 
        },
        data: { read: true }
      })
    } else {
      // Mark all as read
      await (prisma as any).notification.updateMany({
        where: { userId },
        data: { read: true }
      })
    }
  } catch (error) {
    console.error('[Notifications] Error marking as read:', error)
  }
}
