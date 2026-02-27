
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface CurrencyConfig {
    name: string
    symbol: string
    decimal_places: number
    position: 'before' | 'after'
}

export interface CompanyInfo {
    id: number
    name: string
    email: string | boolean
    phone: string | boolean
    street: string | boolean
    city: string | boolean
    currency: CurrencyConfig
}

interface CompanyContextType {
    company: CompanyInfo | null
    formatPrice: (price: number) => string
    isLoading: boolean
}

const DEFAULT_CURRENCY: CurrencyConfig = {
    name: 'USD',
    symbol: '$',
    decimal_places: 2,
    position: 'before',
}

const CompanyContext = createContext<CompanyContextType>({
    company: null,
    formatPrice: (p) => `$${p.toFixed(2)}`,
    isLoading: true,
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [company, setCompany] = useState<CompanyInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetch('/api/odoo/company')
            .then((res) => res.json())
            .then((data) => {
                if (data.company) {
                    setCompany(data.company)
                }
            })
            .catch((err) => console.error('Failed to load company info:', err))
            .finally(() => setIsLoading(false))
    }, [])

    const formatPrice = (price: number): string => {
        const currency = company?.currency || DEFAULT_CURRENCY

        // Safety check for valid number
        if (typeof price !== 'number' || isNaN(price)) {
            return currency.position === 'after' ? `0.00 ${currency.symbol}` : `${currency.symbol} 0.00`
        }

        const formattedNum = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: currency.decimal_places,
            maximumFractionDigits: currency.decimal_places,
        }).format(price)

        if (currency.position === 'after') {
            return `${formattedNum} ${currency.symbol}`
        }
        // Default 'before'
        return `${currency.symbol} ${formattedNum}`
    }

    return (
        <CompanyContext.Provider value={{ company, formatPrice, isLoading }}>
            {children}
        </CompanyContext.Provider>
    )
}

export const useCompany = () => useContext(CompanyContext)
