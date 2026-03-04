'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { Product, PosCategory } from '@/lib/types'

interface ProductContextType {
    products: Product[]
    categories: PosCategory[]
    tags: Record<number, { id: number; name: string; color?: number }>
    taxes: Record<number, { id: number; name: string; amount: number; price_include: boolean }>
    defaultTaxId: number | null
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
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchProducts = async () => {
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
            if (data.meta) {
                if (data.meta.categories) setCategories(data.meta.categories)
                if (data.meta.defaultTaxId !== undefined) setDefaultTaxId(data.meta.defaultTaxId)
            }
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
        if (applicableTaxIds.length === 0 && defaultTaxId) {
            applicableTaxIds = [defaultTaxId]
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

        // JPY Rounding (0 decimals)
        return Math.round(finalPrice)
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
        loading,
        error,
        refreshProducts: fetchProducts,
        getInclusivePrice
    }), [products, categories, tags, taxes, defaultTaxId, loading, error])

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    )
}

export const useProducts = () => useContext(ProductContext)
