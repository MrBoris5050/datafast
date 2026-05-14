import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateReference } from '@/lib/paystack'
import { sendSmsViaArkesel } from '@/lib/arkesel'
import { getPlanPriceForRole } from '@/lib/pricing'
import { getNextOrderNumber } from '@/lib/order-number'
import { purchaseViaVtu } from '@/lib/vtu'
import { validateGhanaPhone } from '@/lib/phone-validation'
import { notifyOrderCompleted, notifyOrderFailed } from '@/lib/notifications'
import { 
  logOrderCreated, 
  logStatusChange, 
  logPaymentProcessing,
  logVtuProcessingStart,
  logVtuApiSuccess,
  logVtuApiFailure,
  logManualProcessing,
  logOrderEvent
} from '@/lib/order-logs'

// Idempotency window in milliseconds (60 seconds)
const IDEMPOTENCY_WINDOW_MS = 60000

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, phoneNumber } = await request.json()
    if (!planId || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate phone number
    const phoneValidation = validateGhanaPhone(phoneNumber)
    if (!phoneValidation.valid) {
      return NextResponse.json({ 
        error: phoneValidation.error || 'Invalid phone number format',
        details: 'Please use a valid Ghana phone number (e.g., 0201234567 or 233201234567)'
      }, { status: 400 })
    }
    const normalizedPhone = phoneValidation.normalized

    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id } }),
      prisma.dataPlan.findUnique({ where: { id: planId } }),
    ])

    if (!user || !plan) {
      return NextResponse.json({ error: 'User or plan not found' }, { status: 404 })
    }

    const price = getPlanPriceForRole(plan as any, user.role)
    const balance = Number(user.walletBalance || 0)
    if (balance < price) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Idempotency check: Prevent duplicate orders within the time window
    const existingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        planId: plan.id,
        phone: normalizedPhone,
        createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) }
      },
      select: { reference: true, status: true, id: true }
    })

    if (existingOrder) {
      console.log(`[Purchase] Duplicate order detected for user ${user.id}`, {
        existingReference: existingOrder.reference,
        planId: plan.id,
        phone: normalizedPhone
      })
      return NextResponse.json({ 
        success: true, 
        reference: existingOrder.reference,
        status: existingOrder.status,
        message: 'Order already in progress. Please wait for it to complete.',
        duplicate: true
      })
    }

    const reference = generateReference()

    let orderRef = reference
    let orderId: string | undefined
    
    // Optimized: Combine order number generation into main transaction
    // This eliminates a separate database round-trip
    await prisma.$transaction(async (tx) => {
      // Get next order number within the transaction
      const maxOrder = await tx.order.findFirst({
        where: { orderNumber: { not: null } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      })
      const orderNumber = maxOrder?.orderNumber ? maxOrder.orderNumber + 1 : 1

      // Deduct wallet
      await tx.user.update({
        where: { id: user.id },
        data: { walletBalance: { decrement: price } },
      })

      // Create order as processing; will complete after VTU provider
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          planId: plan.id,
          amount: price as unknown as any,
          phone: normalizedPhone, // Use normalized phone number
          reference,
          status: 'PROCESSING',
        },
      })
      orderRef = order.reference
      orderId = order.id // Store order ID to avoid duplicate query
      
      // Log order creation (within transaction)
      await logOrderCreated(order.id, reference, {
        orderNumber,
        network: plan.network,
        planName: plan.name,
        amount: Number(price),
        phone: normalizedPhone
      }, tx)
      
      // Log payment processing (within transaction)
      await logPaymentProcessing(order.id, 'wallet', Number(price), {
        reference
      }, tx)

      // Parallelize independent operations for better performance
      await Promise.all([
        // Payment record (wallet) pending until VTU success
        tx.payment.create({
          data: {
            orderId: order.id,
            userId: user.id,
            amount: price as unknown as any,
            status: 'PENDING',
            method: 'wallet',
            reference,
            gateway: 'wallet',
          },
        }),
        // Usage record
        tx.dataUsage.create({
          data: {
            userId: user.id,
            phone: normalizedPhone, // Use normalized phone number
            dataUsed: plan.dataAmount,
            planName: plan.name,
            network: plan.network,
          },
        }),
        // Transaction record pending
        tx.transaction.create({
          data: {
            userId: user.id,
            type: 'PURCHASE',
            amount: price as unknown as any,
            description: `Wallet purchase: ${plan.name}`,
            reference,
            status: 'PENDING',
          },
        })
      ])
    }, {
      maxWait: 15000, // Maximum time to wait for a transaction slot (15 seconds)
      timeout: 30000, // Increased timeout for better reliability (30 seconds)
    })

    // Log VTU processing start (using stored orderId, no duplicate query)
    if (orderId) {
      await logVtuProcessingStart(orderId, plan.network, {
        planName: plan.name,
        phone: normalizedPhone
      })
    }

    // Store plan info for async handler
    const planInfo = { name: plan.name, network: plan.network }
    const orderAmount = price

    // OPTIMIZED: Fire VTU call asynchronously (non-blocking)
    // This allows the API to return immediately while VTU processes in background
    // The order status will be updated via webhook or background job
    
    purchaseViaVtu({ 
      userId: user.id, 
      network: plan.network, 
      planName: plan.name, 
      amount: price, 
      phone: normalizedPhone, // Use normalized phone number
      reference,
      dataAmountMB: plan.dataAmount,
      orderId: orderId // Use stored orderId instead of querying again
    }).then(async (vtu) => {
      if (!orderId) return
      
      // Handle VTU response asynchronously
      if (vtu.success) {
        // Ensure providerReference is properly saved (handle empty strings, null, undefined)
        const providerRef = vtu.providerReference && vtu.providerReference.trim() 
          ? vtu.providerReference.trim() 
          : null
        
        console.log(`[Order Purchase] VTU purchase successful for order ${reference}`, {
          reference,
          network: planInfo.network,
          providerReference: vtu.providerReference,
          providerReferenceAfterProcessing: providerRef,
          isManual: vtu.isManual,
          hasProviderReference: !!vtu.providerReference,
          providerReferenceType: typeof vtu.providerReference
        })
        
        // Success already logged in datahubPurchase function
        
        // Update order status directly (no transaction needed for single operation)
        const updateData: any = { 
          status: 'PROCESSING',
          isManual: false // Explicitly set to false when successful
        }
        
        // Only include providerReference in update if it has a valid value
        if (providerRef) {
          updateData.providerReference = providerRef
        } else {
          // Log warning if we expected a providerReference but didn't get one
          console.warn(`[Order Purchase] No providerReference received for order ${reference} (network: ${planInfo.network})`, {
            vtuResponse: {
              success: vtu.success,
              providerReference: vtu.providerReference,
              message: vtu.message
            }
          })
        }
        
        await prisma.order.update({ 
          where: { reference }, 
          data: updateData
        })
        
        // Log status change
        await logStatusChange(orderId, 'PENDING', 'PROCESSING', {
          providerReference: providerRef || vtu.providerReference
        })
      } else {
        // Only mark manual for genuinely unrecoverable failures:
        //   - Provider explicitly returned isManual (no config, inactive network, etc.)
        //   - 4xx client errors from DataHub (bad request, auth error)
        // Transient failures (timeout, circuit breaker, 5xx, network exceptions) keep
        // the order in PROCESSING so the webhook or stuck-orders cron can resolve it.
        const errorType = (vtu as any).errorDetails?.errorType
        const httpStatus = (vtu as any).errorDetails?.httpStatus
        const isTimeout = errorType === 'TIMEOUT'
        const isCircuitBreakerOpen = errorType === 'CIRCUIT_BREAKER_OPEN'
        const isTransientHttpError = errorType === 'HTTP_ERROR' && httpStatus >= 500
        const isNetworkException = errorType === 'EXCEPTION'
        const isTransient = isTimeout || isCircuitBreakerOpen || isTransientHttpError || isNetworkException
        const shouldMarkManual = vtu.isManual || (!isTransient)
        
        console.warn(`[Order Purchase] VTU purchase failed for order ${reference}`, {
          reference,
          network: planInfo.network,
          message: vtu.message,
          isManual: vtu.isManual,
          isTimeout,
          isCircuitBreakerOpen,
          shouldMarkManual,
          reason: vtu.isManual ? 'VTU returned isManual flag' : (isTimeout ? 'Response timeout (request was sent, waiting for webhook)' : 'VTU purchase failed')
        })
        
        const reason = vtu.isManual 
          ? 'VTU returned isManual flag' 
          : isTimeout 
            ? 'Response timeout - request was sent, waiting for webhook confirmation'
            : isCircuitBreakerOpen
              ? 'Circuit breaker open - VTU provider temporarily unavailable'
              : isTransientHttpError
                ? `Transient HTTP ${httpStatus} error from DataHub - waiting for webhook confirmation`
                : isNetworkException
                  ? 'Network exception sending to DataHub - waiting for webhook confirmation'
                  : 'VTU purchase failed (client error)'
            
        await logVtuApiFailure(
          orderId, 
          'DataHubGH', 
          vtu.message || reason, 
          {
            network: planInfo.network,
            isManual: vtu.isManual,
            isTimeout,
            isCircuitBreakerOpen,
            note: isTimeout ? 'Request was sent to DataHub. Order may complete via webhook.' : undefined
          },
          (vtu as any).errorDetails // Pass through error details from API call
        )
        
        if (shouldMarkManual) {
          await logManualProcessing(orderId, reason, {
            network: planInfo.network,
            error: vtu.message,
            errorDetails: (vtu as any).errorDetails
          })
        } else {
          // Transient error — keep in PROCESSING, log and wait for webhook or cron resolution
          const transientNote = isTimeout
            ? 'Request sent to DataHub but response timed out. Waiting for webhook confirmation.'
            : isCircuitBreakerOpen
              ? 'Circuit breaker is open. Order will be retried when provider recovers.'
              : isTransientHttpError
                ? `DataHub returned HTTP ${httpStatus}. Order remains in PROCESSING pending webhook.`
                : 'Network exception contacting DataHub. Order remains in PROCESSING pending webhook.'
          await logOrderEvent(orderId, transientNote, 'WARNING', {
            network: planInfo.network,
            errorType,
            httpStatus,
            timeoutMs: (vtu as any).errorDetails?.timeoutMs,
            note: 'Order may complete via webhook if DataHub processed it successfully'
          })
        }
        
        // Update order status directly (no transaction needed for single operation)
        // For timeout errors, keep status as PROCESSING and don't mark as manual
        // This allows webhook to update it later if DataHub processed it
        await prisma.order.update({ 
          where: { reference }, 
          data: { 
            status: shouldMarkManual ? 'PENDING' : 'PROCESSING', // Keep PROCESSING for timeouts
            isManual: shouldMarkManual, // Only mark manual for actual failures, not timeouts
            providerReference: null
          } 
        })
        
        // Log status change
        if (shouldMarkManual) {
          await logStatusChange(orderId, 'PROCESSING', 'PENDING', {
            reason: 'VTU failure - marked for manual processing'
          })
        } else {
          await logOrderEvent(
            orderId,
            'Order remains in PROCESSING status. Waiting for webhook confirmation from DataHub.',
            'INFO',
            {
              reason: 'Response timeout but request was sent',
              network: planInfo.network
            }
          )
        }
      }
    }).catch(async (vtuError: any) => {
      if (!orderId) return
      
      console.error(`[Order Purchase] VTU purchase exception for order ${reference}:`, {
        reference,
        network: planInfo.network,
        error: vtuError?.message || String(vtuError),
        stack: vtuError?.stack
      })
      
      await logVtuApiFailure(
        orderId, 
        'DataHubGH', 
        vtuError?.message || String(vtuError), 
        {
          network: planInfo.network,
          errorType: 'exception'
        },
        {
          errorType: 'EXCEPTION',
          errorName: vtuError?.name,
          errorMessage: vtuError?.message || String(vtuError),
          stack: vtuError?.stack
        }
      )
      await logManualProcessing(orderId, 'Exception during VTU processing', {
        network: planInfo.network,
        error: vtuError?.message || String(vtuError),
        errorName: vtuError?.name,
        stack: vtuError?.stack?.substring(0, 500)
      })
      
      // Mark as manual for admin to process (direct update, no transaction needed)
      await prisma.order.update({ 
        where: { reference }, 
        data: { 
          status: 'PENDING',
          isManual: true,
          providerReference: null
        } 
      })
      
      // Log status change
      await logStatusChange(orderId, 'PROCESSING', 'PENDING', {
        reason: 'Exception - marked for manual processing'
      })
    })

    // Return immediately - order is PROCESSING and will be updated asynchronously
    return NextResponse.json({ 
      success: true, 
      reference,
      status: 'PROCESSING',
      message: 'Order is being processed. You will be notified when it completes.'
    })
  } catch (error: any) {
    console.error('Wallet purchase error:', error)
    const errorMessage = error?.message || 'Internal server error'
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}


