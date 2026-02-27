'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Product, CartItem, CartItemMeta } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'

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
  updateItemNotes: (cartItemId: string, notes: string) => void
  clearCart: () => void
  getCartTotal: () => number
  cartCount: number
  isCartOpen: boolean
  setIsCartOpen: (isOpen: boolean) => void
  hasOpenedAutomatically: boolean
  lastOrder: LastOrder | null
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
  const [hasOpenedAutomatically, setHasOpenedAutomatically] = useState(false)
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const { toast } = useToast()

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
            if (comboA[i].combo_line_id !== comboB[i]?.combo_line_id)
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

      toast({
        title: 'Added to cart',
        description: `${product.name} has been added to your order.`,
      })
      if (!hasOpenedAutomatically) {
        setIsCartOpen(true)
        setHasOpenedAutomatically(true)
      }
    },
    [toast, hasOpenedAutomatically],
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

  const getCartTotal = useCallback(() => {
    return cartItems.reduce(
      (total, item) => total + item.product.list_price * item.quantity,
      0,
    )
  }, [cartItems])

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
    setCartItems([])
  }, [cartItems, getCartTotal])

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    updateItemNotes,
    clearCart,
    getCartTotal,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    hasOpenedAutomatically,
    lastOrder,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
