'use client'

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from 'react'
import type { PaymentConfigResponse } from '@/lib/types'

interface PaymentConfigContextType {
  config: PaymentConfigResponse | null
  isLoading: boolean
  error: string | null
}

const PaymentConfigContext = createContext<PaymentConfigContextType>({
  config: null,
  isLoading: false,
  error: null,
})

export function PaymentConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PaymentConfigResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prefetch payment config on app init (once globally, not on every checkout open)
    const fetchConfig = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/payment/config', {
          cache: 'force-cache',
        })
        if (!response.ok) {
          throw new Error(
            `Failed to fetch payment config: ${response.statusText}`,
          )
        }
        const data: PaymentConfigResponse = await response.json()
        setConfig(data)
        setError(null)
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Unknown error fetching payment config'
        console.error('[PaymentConfigContext] Error:', errorMsg)
        setError(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

  return (
    <PaymentConfigContext.Provider
      value={{ config, isLoading, error }}
    >
      {children}
    </PaymentConfigContext.Provider>
  )
}

export function usePaymentConfig() {
  const context = useContext(PaymentConfigContext)
  if (!context) {
    throw new Error(
      'usePaymentConfig must be used within PaymentConfigProvider',
    )
  }
  return context
}
