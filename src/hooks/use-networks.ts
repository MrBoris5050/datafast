import { useState, useEffect } from 'react'

type Network = {
  id: string
  name: string
  isActive: boolean
}

const CACHE_KEY = 'networks_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheData {
  data: Network[]
  timestamp: number
}

export function useNetworks() {
  const [networks, setNetworks] = useState<Network[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchNetworks = async () => {
      // Check cache first
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(CACHE_KEY)
          if (cached) {
            const cacheData: CacheData = JSON.parse(cached)
            const now = Date.now()
            
            // Use cached data if still valid
            if (now - cacheData.timestamp < CACHE_DURATION) {
              setNetworks(cacheData.data)
              setIsLoading(false)
              return
            }
          }
        } catch (e) {
          // Cache parse error, continue to fetch
        }
      }

      // Fetch fresh data
      await fetchNetworksFromAPI()
    }

    const fetchNetworksFromAPI = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const res = await fetch('/api/networks', {
          // Use browser cache - the API endpoint has its own revalidation
          cache: 'default'
        })

        if (!res.ok) {
          throw new Error('Failed to fetch networks')
        }

        const result = await res.json()
        const networksData = result.data || []

        setNetworks(networksData)
        
        // Update cache
        if (typeof window !== 'undefined') {
          const cacheData: CacheData = {
            data: networksData,
            timestamp: Date.now()
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
        }
      } catch (err) {
        console.error('Error fetching networks:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch networks')
        
        // Try to use stale cache if available
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
              const cacheData: CacheData = JSON.parse(cached)
              setNetworks(cacheData.data)
            }
          } catch (e) {
            // Ignore cache errors
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchNetworks()
  }, [])

  return { networks, isLoading, error }
}

