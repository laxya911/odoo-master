'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { Product, PosCategory } from '@/lib/types'

interface ProductContextType {
    products: Product[]
    categories: PosCategory[]
    tags: Record<number, { id: number; name: string; color?: number }>
    loading: boolean
    error: Error | null
    refreshProducts: () => Promise<void>
}

const ProductContext = createContext<ProductContextType>({
    products: [],
    categories: [],
    tags: {},
    loading: true,
    error: null,
    refreshProducts: async () => { },
})

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<PosCategory[]>([])
    const [tags, setTags] = useState<Record<number, { id: number; name: string; color?: number }>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchProducts = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/odoo/restaurant/products?limit=100')
            if (!response.ok) {
                throw new Error(`Failed to fetch products: ${response.statusText}`)
            }
            const data = await response.json()

            if (data.data) {
                setProducts(data.data)
            }
            if (data.meta) {
                if (data.meta.tags) setTags(data.meta.tags)
                if (data.meta.categories) setCategories(data.meta.categories)
            }
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error fetching products'))
            console.error('Error fetching Odoo products:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    const value = useMemo(() => ({
        products,
        categories,
        tags,
        loading,
        error,
        refreshProducts: fetchProducts
    }), [products, categories, tags, loading, error])

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    )
}

export const useProducts = () => useContext(ProductContext)
