'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { Product, PosCategory } from '@/lib/types'

interface ProductContextType {
    products: Product[]
    categories: PosCategory[]
    tags: Record<number, { id: number; name: string; color?: number }>
    taxes: Record<number, { id: number; name: string; amount: number; price_include: boolean }>
    defaultTaxId: number | null
    currency: { name: string; decimal_places: number }
    loading: boolean
    error: Error | null
    refreshProducts: () => Promise<void>
    getInclusivePrice: (product: Product, basePrice?: number) => number
}

const ProductContext = createContext<ProductContextType>({
    products: [],
    categories: [],
    tags: {},
    taxes: {},
    defaultTaxId: null,
    currency: { name: 'jpy', decimal_places: 0 },
    loading: true,
    error: null,
    refreshProducts: async () => { },
    getInclusivePrice: () => 0,
})

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<PosCategory[]>([])
    const [tags, setTags] = useState<Record<number, { id: number; name: string; color?: number }>>({})
    const [taxes, setTaxes] = useState<Record<number, { id: number; name: string; amount: number; price_include: boolean }>>({})
    const [defaultTaxId, setDefaultTaxId] = useState<number | null>(null)
    const [currency, setCurrency] = useState<{ name: string; decimal_places: number }>({ name: 'jpy', decimal_places: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchProducts = async (forceRefresh = false) => {
        const CACHE_KEY = 'odoo_products_cache'
        const CACHE_TIME = 15 * 60 * 1000 // 15 minutes

        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached)
                    if (Date.now() - timestamp < CACHE_TIME) {
                        console.log('[ProductContext] Using cached products (valid for 15m)')
                        if (data.data) setProducts(data.data)
                        if (data.tags) setTags(data.tags)
                        if (data.taxes) setTaxes(data.taxes)
                        if (data.defaultTaxId !== undefined) setDefaultTaxId(data.defaultTaxId)
                        if (data.currency) setCurrency(data.currency)
                        if (data.meta) {
                            if (data.meta.categories) setCategories(data.meta.categories)
                            if (data.meta.defaultTaxId !== undefined) setDefaultTaxId(data.meta.defaultTaxId)
                            if (data.meta.currency) setCurrency(data.meta.currency)
                        }
                        setLoading(false)
                        return
                    }
                } catch (e) {
                    console.error('[ProductContext] Error parsing cache:', e)
                }
            }
        }

        setLoading(true)
        try {
            const response = await fetch('/api/odoo/restaurant/products?limit=100')
            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg || `Error ${response.status}`;
                } catch {
                    // Fallback to status text if not JSON
                }
                throw new Error(`Failed to fetch products: ${errorMsg}`)
            }
            const data = await response.json()

            if (data.data) {
                setProducts(data.data)
            }
            if (data.tags) setTags(data.tags)
            if (data.taxes) setTaxes(data.taxes)
            if (data.defaultTaxId !== undefined) setDefaultTaxId(data.defaultTaxId)
            if (data.currency) setCurrency(data.currency)
            if (data.meta) {
                if (data.meta.categories) setCategories(data.meta.categories)
                if (data.meta.defaultTaxId !== undefined) setDefaultTaxId(data.meta.defaultTaxId)
                if (data.meta.currency) setCurrency(data.meta.currency)
            }

            // Update cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }))

            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error fetching products'))
            console.error('Error fetching Odoo products:', err)
        } finally {
            setLoading(false)
        }
    }

    const getInclusivePrice = (product: Product, basePrice?: number) => {
        const price = basePrice ?? product.list_price
        let applicableTaxIds = product.taxes_id || []

        // --- Default Tax Fallback ---
        // CAUTION: Only apply fallback if we are sure the product isn't already tax-inclusive
        if (applicableTaxIds.length === 0 && defaultTaxId) {
            // applicableTaxIds = [defaultTaxId] // Disabling this fallback as it often causes mismatches with POS Fiscal Positions
        }

        // 1. Identify already included taxes
        let totalIncludedRate = 0
        applicableTaxIds.forEach(tid => {
            const tx = taxes[tid]
            if (tx && tx.price_include) totalIncludedRate += (tx.amount / 100)
        })

        // 2. Extract TRUE pre-tax base price
        const preTaxBase = price / (1 + totalIncludedRate)

        // 3. Add ALL taxes (included and excluded)
        let totalTaxRate = 0
        applicableTaxIds.forEach(tid => {
            const tx = taxes[tid]
            if (tx) totalTaxRate += (tx.amount / 100)
        })

        const finalPrice = preTaxBase * (1 + totalTaxRate)

        // Support dynamic decimal places from Odoo currency settings
        return Number(finalPrice.toFixed(currency.decimal_places))
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    const value = useMemo(() => ({
        products,
        categories,
        tags,
        taxes,
        defaultTaxId,
        currency,
        loading,
        error,
        refreshProducts: () => fetchProducts(true),
        getInclusivePrice
    }), [products, categories, tags, taxes, defaultTaxId, currency, loading, error])

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    )
}

export const useProducts = () => useContext(ProductContext)
