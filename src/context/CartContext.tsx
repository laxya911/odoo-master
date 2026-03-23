'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Product, CartItem, CartItemMeta } from '@/lib/types'
import { toast } from 'sonner'
import { calculateItemPricing } from '@/lib/pricing-utils'
import { useProducts } from './ProductContext'
import { useTranslations } from 'next-intl'
import { useAuth } from './AuthContext'
import { useProductConfigurator } from '@/hooks/use-product-configurator'

export interface LastOrder {
  id: string
  items: CartItem[]
  total: number
  subtotal: number
  tax: number
  date: string
}

interface CartContextType {
  cartItems: CartItem[]
  addToCart: (product: Product, quantity?: number, meta?: CartItemMeta) => void
  removeFromCart: (cartItemId: string) => void
  updateItemQuantity: (cartItemId: string, quantity: number) => void
  updateCartItem: (cartItemId: string, quantity: number, meta: CartItemMeta) => void
  updateItemNotes: (cartItemId: string, notes: string) => void
  clearCart: () => void
  getCartTotal: () => number
  cartCount: number
  isCartOpen: boolean
  setIsCartOpen: (isOpen: boolean) => void
  isCheckoutOpen: boolean
  setIsCheckoutOpen: (isOpen: boolean) => void
  hasOpenedAutomatically: boolean
  lastOrder: LastOrder | null
  getCartBreakdown: () => { total: number; subtotal: number; tax: number }
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [hasOpenedAutomatically, setHasOpenedAutomatically] = useState(false)
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const { user, isAuthenticated } = useAuth()
  const t = useTranslations('cart')

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('ram_cart')
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse cart from localStorage:', e)
      }
    }
    setIsInitialized(true)
  }, [])

  // Save cart to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('ram_cart', JSON.stringify(cartItems))
    }
  }, [cartItems, isInitialized])

  // Sync merge with Odoo when authenticated (only on first init)
  const [hasSyncedOnInit, setHasSyncedOnInit] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setHasSyncedOnInit(false);
      return;
    }

    const syncWithOdoo = async () => {
      if (!isInitialized || hasSyncedOnInit) return

      try {
        const res = await fetch('/api/odoo/restaurant/cart')
        const data = await res.json()
        
        if (data.cart && data.cart.length > 0) {
          // If local is empty, just take remote
          if (cartItems.length === 0) {
            setCartItems(data.cart)
          } else {
            // Merge logic: Add remote items that aren't already in local (by product id)
            setCartItems(prev => {
                const combined = [...prev];
                data.cart.forEach((remoteItem: CartItem) => {
                    const exists = combined.some(localItem => localItem.product.id === remoteItem.product.id);
                    if (!exists) combined.push(remoteItem);
                });
                return combined;
            });
          }
        }
        setHasSyncedOnInit(true)
      } catch (e) {
        console.error('Failed to fetch cart from Odoo:', e)
      }
    }

    syncWithOdoo()
  }, [isAuthenticated, isInitialized, hasSyncedOnInit])

  // Save to Odoo on change
  useEffect(() => {
    const saveToOdoo = async () => {
      if (!isAuthenticated || !isInitialized || !hasSyncedOnInit) return

      try {
        await fetch('/api/odoo/restaurant/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: cartItems })
        })
      } catch (e) {
        console.error('Failed to save cart to Odoo:', e)
      }
    }

    // Debounce save to Odoo to avoid excessive RPC calls
    const timer = setTimeout(() => {
        saveToOdoo()
    }, 2000)

    return () => clearTimeout(timer)
  }, [cartItems, isAuthenticated, isInitialized])

  const addToCart = useCallback(
    (product: Product, quantity: number = 1, meta?: CartItemMeta) => {
      setCartItems((prevItems) => {
        // Determine equality: same product id and same metadata
        const existingItem = prevItems.find((item) => {
          if (item.product.id !== product.id) return false

          // Compare metadata: attributes
          const attrA = item.meta?.attribute_value_ids || []
          const attrB = meta?.attribute_value_ids || []
          if (attrA.length !== attrB.length) return false
          if (!attrA.every((v) => attrB.includes(v))) return false

          // Compare metadata: combo selections
          const comboA = item.meta?.combo_selections || []
          const comboB = meta?.combo_selections || []
          if (comboA.length !== comboB.length) return false
          for (let i = 0; i < comboA.length; i++) {
            if (comboA[i].combo_id !== comboB[i]?.combo_id)
              return false
            const pidsA = comboA[i].product_ids.sort()
            const pidsB = (comboB[i]?.product_ids || []).sort()
            if (pidsA.length !== pidsB.length) return false
            if (!pidsA.every((p: number, idx: number) => p === pidsB[idx])) return false
          }

          // Compare metadata: extras
          const extraA = (item.meta?.extras || []).map((e: Product) => e.id).sort()
          const extraB = (meta?.extras || []).map((e: Product) => e.id).sort()
          if (extraA.length !== extraB.length) return false
          if (!extraA.every((v: number, idx: number) => v === extraB[idx])) return false

          return true
        })

        if (existingItem) {
          return prevItems.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        } else {
          const newCartItem: CartItem = {
            id: crypto.randomUUID(),
            product,
            quantity,
            meta,
          }
          return [...prevItems, newCartItem]
        }
      })

      toast.success(t('added'), {
        description: t('addedDesc', { product: product.name }),
      })
      if (!hasOpenedAutomatically) {
        setIsCartOpen(true)
        setHasOpenedAutomatically(true)
      }
    },
    [t, hasOpenedAutomatically],
  )

  const removeFromCart = useCallback((cartItemId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== cartItemId),
    )
  }, [])

  const updateItemQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(cartItemId)
      } else {
        setCartItems((prevItems) =>
          prevItems.map((item) =>
            item.id === cartItemId ? { ...item, quantity } : item,
          ),
        )
      }
    },
    [removeFromCart],
  )

  const updateItemNotes = useCallback((cartItemId: string, notes: string) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === cartItemId ? { ...item, notes } : item,
      ),
    )
  }, [])

  const updateCartItem = useCallback(
    (cartItemId: string, quantity: number, meta: CartItemMeta) => {
      setCartItems((prevItems) => {
        const item = prevItems.find((p) => p.id === cartItemId)
        if (!item) return prevItems

        return prevItems.map((p) =>
          p.id === cartItemId ? { ...p, quantity, meta } : p,
        )
      })
      toast.success(t('added'), {
        description: t('addedDesc', { product: '' }), // Or specific msg for update
      })
    },
    [t],
  )

  const { taxes, defaultTaxId, currency } = useProducts()

  const getCartBreakdown = useCallback(() => {
    let total = 0
    let tax = 0
    let net = 0

    cartItems.forEach((item) => {
      const { totalPaid: lineTotal, totalTax: lineTax, netAmount: lineNet } =
        calculateItemPricing(item.product, item.meta, taxes, defaultTaxId, currency)

      total += lineTotal * item.quantity
      tax += lineTax * item.quantity
      net += lineNet * item.quantity
    })

    return { total, subtotal: net, tax }
  }, [cartItems, taxes, defaultTaxId])

  const getCartTotal = useCallback(() => {
    return getCartBreakdown().total
  }, [getCartBreakdown])

  const clearCart = useCallback(() => {
    // Capture last order before clearing if needed
    if (cartItems.length > 0) {
      const total = getCartTotal();
      const subtotal = total / 1.1;
      const tax = total - subtotal;

      setLastOrder({
        id: Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
        items: cartItems.map(item => ({
          ...item,
          // Add selectedAttributes for compatibility with TrackOrderPage
          selectedAttributes: item.meta?.attribute_value_ids ?
            { attributes: item.meta.attribute_value_ids } : undefined
        })),
        total,
        subtotal,
        tax,
        date: new Date().toLocaleDateString()
      });
    }
    
    setCartItems([]);
    
    // Clear in Odoo as well
    if (isAuthenticated) {
        fetch('/api/odoo/restaurant/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: [] })
        }).catch(err => console.error('Failed to clear cart in Odoo:', err));
    }
  }, [cartItems, getCartTotal, isAuthenticated])

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    updateCartItem,
    updateItemNotes,
    clearCart,
    getCartTotal,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    isCheckoutOpen,
    setIsCheckoutOpen,
    hasOpenedAutomatically,
    lastOrder,
    getCartBreakdown,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
