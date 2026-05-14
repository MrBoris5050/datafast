import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/api-auth'
import { getPlanPriceForRole } from '@/lib/pricing'
import { dispatchToProvider } from '@/lib/provider-dispatch'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { formatError, getErrorStatusCode } from '@/lib/error-format'
import { validateGhanaPhone } from '@/lib/phone-validation'
import { logOrderCreated, logOrderEvent, logPaymentProcessing } from '@/lib/order-logs'

// Idempotency window in milliseconds (60 seconds)
const IDEMPOTENCY_WINDOW_MS = 60000

export async function POST(req: Request) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth.ok || !auth.userId) {
      // Check if it's a database connection error
      if (auth.error?.includes('Database connection failed')) {
        return NextResponse.json({ 
          error: auth.error,
          message: 'The database server is currently unreachable. Please try again later or contact support if the issue persists.'
        }, { status: 503 })
      }
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 })
    }
    const userId = auth.userId as string

    // Check rate limit (150 requests per minute per user)
    const rateLimit = checkRateLimit(userId, 150, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Maximum 150 requests per minute.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimit)
        }
      )
    }

    const body = await req.json().catch(() => ({}))
    // Accept both 'phone' and 'Phone' (case-insensitive)
    const phoneValue = (body as any).Phone || (body as any).phone
    const datasizeValue = (body as any).Datasize || (body as any).datasize
    const { network, reference } = body as { network?: string; reference?: string }
    
    if (!network || !phoneValue || !datasizeValue) {
      return NextResponse.json({ error: 'Missing network, Phone, or Datasize' }, { status: 400 })
    }

    // Validate phone number
    const phoneValidation = validateGhanaPhone(phoneValue)
    if (!phoneValidation.valid) {
      return NextResponse.json({ 
        error: phoneValidation.error || 'Invalid phone number format',
        details: 'Please use a valid Ghana phone number (e.g., 0201234567 or 233201234567)'
      }, { status: 400 })
    }
    const normalizedPhone = phoneValidation.normalized

    // Convert Datasize from GB to MB (database stores in MB)
    // Handle both string and number inputs
    const datasizeNumber = typeof datasizeValue === 'string' ? parseFloat(datasizeValue) : datasizeValue
    if (isNaN(datasizeNumber) || datasizeNumber <= 0) {
      return NextResponse.json({ error: 'Datasize must be a valid positive number' }, { status: 400 })
    }
    const dataAmountMB = Math.round(datasizeNumber * 1024)

    // Generate reference early for deduplication check
    const ref = reference || `api_${Math.random().toString(36).substring(2, 8)}`

    // Check for duplicate reference if provided
    if (reference) {
      const existingOrder = await prisma.order.findUnique({
        where: { reference },
        select: { id: true, reference: true, status: true, amount: true, phone: true, createdAt: true }
      })
      if (existingOrder) {
        return NextResponse.json({ 
          error: 'Duplicate reference',
          message: 'An order with this reference already exists',
          existingOrder: {
            id: existingOrder.id,
            reference: existingOrder.reference,
            status: existingOrder.status,
            amount: Number(existingOrder.amount),
            phone: existingOrder.phone,
            createdAt: existingOrder.createdAt
          }
        }, { status: 409 })
      }
    }

    // Fetch plan by network and data size
    const plan = await prisma.dataPlan.findFirst({ 
      where: { 
        network: network.toUpperCase(),
        dataAmount: dataAmountMB,
        isActive: true
      } 
    })
    if (!plan) return NextResponse.json({ error: 'No active plan found for the specified network and data size' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const amount = getPlanPriceForRole(plan as any, user.role)

    // Idempotency check: Prevent duplicate orders within the time window
    const existingRecentOrder = await prisma.order.findFirst({
      where: {
        userId,
        planId: plan.id,
        phone: normalizedPhone,
        createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) }
      },
      select: { 
        id: true, 
        reference: true, 
        status: true, 
        amount: true, 
        phone: true, 
        createdAt: true,
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            dataAmount: true,
            validity: true,
            network: true
          }
        }
      }
    })

    if (existingRecentOrder) {
      console.log(`[Developer API] Duplicate order detected for user ${userId}`, {
        existingReference: existingRecentOrder.reference,
        planId: plan.id,
        phone: normalizedPhone
      })
      return NextResponse.json({ 
        success: true, 
        data: {
          order: {
            id: existingRecentOrder.id,
            reference: existingRecentOrder.reference,
            status: existingRecentOrder.status,
            amount: Number(existingRecentOrder.amount),
            phone: existingRecentOrder.phone,
            createdAt: existingRecentOrder.createdAt,
            plan: existingRecentOrder.plan ? {
              id: existingRecentOrder.plan.id,
              name: existingRecentOrder.plan.name,
              description: existingRecentOrder.plan.description,
              dataAmount: existingRecentOrder.plan.dataAmount,
              dataAmountGB: (existingRecentOrder.plan.dataAmount / 1024).toFixed(2),
              validity: existingRecentOrder.plan.validity,
              network: existingRecentOrder.plan.network
            } : null
          },
          currentBalance: Number(user.walletBalance || 0),
          message: 'Order already in progress. This is a duplicate request.',
          duplicate: true
        }
      }, {
        headers: getRateLimitHeaders(rateLimit)
      })
    }

    // Atomic: debit wallet + create order + create transaction
    const result = await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.order.findFirst({
        where: { orderNumber: { not: null } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      })
      const orderNumber = (maxOrder?.orderNumber ?? 0) + 1

      const fresh = await tx.user.findUnique({ where: { id: userId }, select: { walletBalance: true } })
      if (!fresh) throw new Error('User not found')
      if (Number(fresh.walletBalance) < Number(amount)) throw new Error('Insufficient wallet balance')

      const newBalance = Number(fresh.walletBalance) - Number(amount)

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: newBalance.toFixed(2) as unknown as any },
      })

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          planId: plan.id,
          amount: amount as unknown as any,
          phone: normalizedPhone,
          reference: ref,
          status: 'PROCESSING',
        },
        include: {
          plan: { select: { id: true, name: true, description: true, dataAmount: true, validity: true, network: true } }
        }
      })

      await tx.transaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          amount: amount as unknown as any,
          description: `API purchase of ${plan.name}`,
          reference: ref,
          status: 'PENDING',
        },
      })

      await logOrderCreated(order.id, ref, { orderNumber, network: plan.network, planName: plan.name, amount: Number(amount), phone: normalizedPhone, source: 'developer-api' }, tx)
      await logPaymentProcessing(order.id, 'wallet', Number(amount), { reference: ref }, tx)

      return { order, newBalance }
    })

    const { order: createdOrder, newBalance } = result

    // Load network provider config then dispatch after response is sent
    const networkConfig = await prisma.network.findUnique({ where: { name: plan.network } })

    const devProv = networkConfig?.apiProvider?.toUpperCase() ?? ''
    const devCredsEnv =
      devProv === 'DATADASHGH'
        ? !!process.env.DATADASHGH_API_KEY
        : devProv === 'DATAWAVEGH'
          ? !!process.env.DATAWAVEGH_API_KEY
          : !!process.env.DATAHUBGH_API_KEY

    await logOrderEvent(createdOrder.id, `Dispatching to provider: ${networkConfig?.apiProvider ?? 'MANUAL'}`, 'INFO', {
      network:            plan.network,
      provider:           networkConfig?.apiProvider ?? null,
      providerNetworkKey: networkConfig?.providerNetworkKey ?? null,
      source:             'developer-api',
      credentialsSource:  devCredsEnv ? 'env' : 'db',
    })

    after(async () => {
      await dispatchToProvider({
        orderId:      createdOrder.id,
        reference:    ref,
        network: {
          apiProvider:        networkConfig?.apiProvider        ?? null,
          apiKey:             networkConfig?.apiKey             ?? null,
          baseUrl:            networkConfig?.baseUrl            ?? null,
          providerNetworkKey: networkConfig?.providerNetworkKey ?? null,
        },
        phone:        normalizedPhone,
        dataAmountMB: plan.dataAmount,
        planName:     plan.name,
        planNetwork:  plan.network,
        providerPlanId: plan.providerPlanId,
      })
    })

    // Return immediately with order details (using data from transaction, no extra query)
    return NextResponse.json({ 
      success: true, 
      data: { 
        order: {
          id: createdOrder.id,
          reference: createdOrder.reference,
          status: createdOrder.status,
          amount: Number(createdOrder.amount || 0),
          phone: createdOrder.phone,
          providerReference: createdOrder.providerReference,
          createdAt: createdOrder.createdAt,
          plan: createdOrder.plan ? {
            id: createdOrder.plan.id,
            name: createdOrder.plan.name,
            description: createdOrder.plan.description,
            dataAmount: createdOrder.plan.dataAmount,
            dataAmountGB: (createdOrder.plan.dataAmount / 1024).toFixed(2),
            validity: createdOrder.plan.validity,
            network: createdOrder.plan.network
          } : null
        },
        currentBalance: newBalance, // Use balance from transaction
        message: 'Order is being processed. Status will be updated asynchronously.'
      } 
    }, {
      headers: getRateLimitHeaders(rateLimit)
    })
  } catch (e: any) {
    // Log full error for debugging (server-side only)
    console.error('Purchase endpoint error:', {
      error: e?.message || String(e),
      code: e?.code,
      stack: e?.stack?.substring(0, 500)
    })
    
    // Format error for client response
    const errorMessage = formatError(e)
    const statusCode = getErrorStatusCode(e)
    
    return NextResponse.json({ 
      error: errorMessage
    }, { status: statusCode })
  }
}


