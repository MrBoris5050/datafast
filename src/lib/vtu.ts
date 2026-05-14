import { prisma } from '@/lib/db'
import { datahubPurchase, ProviderPurchaseResult } from './providers/datahubgh'

export type VtuPurchaseInput = {
	userId: string
	network: string
	planName?: string
	amount: number
	phone: string
	reference: string
	dataAmountMB?: number // Data amount in MB for capacity calculation
	orderId?: string // Optional order ID for logging
}

// Environment variable configuration (takes precedence over database)
const DATAHUBGH_API_KEY = process.env.DATAHUBGH_API_KEY
const DATAHUBGH_BASE_URL = process.env.DATAHUBGH_BASE_URL || 'https://user.datahubgh.com/api'
const USE_ENV_FOR_VTU = process.env.USE_ENV_FOR_VTU === 'true' || !!DATAHUBGH_API_KEY

export async function getDefaultVtuSource() {
	// If environment variables are set, use them (no DB lookup needed)
	if (USE_ENV_FOR_VTU && DATAHUBGH_API_KEY) {
		return {
			id: 'env-config',
			name: 'DataHubGH (Environment)',
			provider: 'DATAHUBGH',
			baseUrl: DATAHUBGH_BASE_URL,
			apiKey: DATAHUBGH_API_KEY,
			isDefault: true,
			active: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		}
	}
	
	// Fallback to database configuration
	const src = await prisma.vtuSource.findFirst({ where: { active: true, isDefault: true } })
	if (src) return src
	return prisma.vtuSource.findFirst({ where: { active: true } })
}

export async function purchaseViaVtu(input: VtuPurchaseInput): Promise<ProviderPurchaseResult & { sourceId?: string; isManual?: boolean }> {
	// Normalize network name for consistent lookup
	const normalizedNetwork = input.network.trim().toUpperCase()
	
	// First, check for network-specific API settings
	// Try exact match first, then case-insensitive search
	let networkSetting = await prisma.networkApiSetting.findUnique({
		where: { networkName: normalizedNetwork },
		include: { vtuSource: true }
	})
	
	// If not found, try original case (for backward compatibility)
	if (!networkSetting && normalizedNetwork !== input.network) {
		networkSetting = await prisma.networkApiSetting.findUnique({
			where: { networkName: input.network },
			include: { vtuSource: true }
		})
	}
	
	// If still not found, try case-insensitive search
	if (!networkSetting) {
		const allSettings = await prisma.networkApiSetting.findMany({
			include: { vtuSource: true }
		})
		networkSetting = allSettings.find(s => 
			s.networkName.trim().toUpperCase() === normalizedNetwork
		) || null
	}

	// If network-specific setting exists
	if (networkSetting) {
		// If network is inactive, treat as manual
		if (!networkSetting.isActive) {
			console.log(`[VTU] Network ${networkSetting.networkName} is inactive, using manual processing`, {
				inputNetwork: input.network,
				configuredNetwork: networkSetting.networkName
			})
			return { 
				success: false, 
				message: `Network ${networkSetting.networkName} is set to inactive. Order will be processed manually.`,
				isManual: true
			}
		}

		// If no VTU source assigned (manual processing)
		if (!networkSetting.vtuSourceId || !networkSetting.vtuSource) {
			console.log(`[VTU] Network ${networkSetting.networkName} is set to manual processing (no VTU source assigned)`, {
				networkSetting: {
					id: networkSetting.id,
					networkName: networkSetting.networkName,
					vtuSourceId: networkSetting.vtuSourceId,
					hasVtuSource: !!networkSetting.vtuSource
				},
				inputNetwork: input.network
			})
			return { 
				success: false, 
				message: `Network ${networkSetting.networkName} is configured for manual processing. Order will be queued for admin review.`,
				isManual: true
			}
		}

		// Check if VTU source is active
		const source = networkSetting.vtuSource
		if (!source.active) {
			console.error(`[VTU] Network ${networkSetting.networkName} has an inactive VTU source:`, {
				sourceId: source.id,
				sourceName: source.name,
				provider: source.provider,
				active: source.active,
				inputNetwork: input.network
			})
			return {
				success: false,
				message: `VTU source for network ${networkSetting.networkName} is inactive. Order will be processed manually.`,
				isManual: true
			}
		}

		// Use network-specific VTU source
		console.log('[VTU] Using network-specific VTU source:', { 
			network: input.network,
			name: source.name, 
			provider: source.provider, 
			baseUrl: source.baseUrl,
			vtuKey: networkSetting.vtuKey,
			sourceId: source.id,
			sourceActive: source.active
		})

		let result: ProviderPurchaseResult
		if (source.provider === 'DATAHUBGH') {
			result = await datahubPurchase({
				baseUrl: source.baseUrl,
				apiKey: source.apiKey,
				network: input.network,
				planName: input.planName,
				amount: input.amount,
				phone: input.phone,
				reference: input.reference,
				dataAmountMB: input.dataAmountMB,
				orderId: input.orderId,
			})
		} else {
			console.error('[VTU] Unsupported VTU provider:', source.provider, 'for network:', input.network)
			result = { 
				success: false, 
				message: `Unsupported provider: ${source.provider}`,
				errorDetails: {
					errorType: 'UNSUPPORTED_PROVIDER',
					provider: source.provider
				}
			}
		}
		console.log('[VTU] Purchase result:', { 
			network: input.network,
			success: result.success, 
			message: result.message,
			providerReference: result.providerReference 
		})
		return { ...result, sourceId: source.id }
	}

	// If no network-specific setting exists, default to manual processing
	// This ensures networks must be explicitly configured to use automatic processing
	console.log(`[VTU] No NetworkApiSetting found for network ${input.network}, using manual processing`, {
		inputNetwork: input.network,
		normalizedNetwork,
		reason: 'No NetworkApiSetting configured for this network. Please add the network in admin settings.'
	})
	return { 
		success: false, 
		message: `Network ${input.network} is not configured with a VTU source. Order will be processed manually. Please configure the network in admin settings.`,
		isManual: true
	}
}
