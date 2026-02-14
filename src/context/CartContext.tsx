'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Product, CartItem } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'

interface CartContextType {
  cartItems: CartItem[]
  addToCart: (
    product: Product,
    quantity?: number,
    opts?: { selectedOptionIds?: number[]; extras?: Product[] },
  ) => void
  removeFromCart: (cartItemId: string) => void
  updateItemQuantity: (cartItemId: string, quantity: number) => void
  updateItemNotes: (cartItemId: string, notes: string) => void
  clearCart: () => void
  getCartTotal: () => number
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
  const { toast } = useToast()

  const addToCart = useCallback(
    (
      product: Product,
      quantity: number = 1,
      opts?: { selectedOptionIds?: number[]; extras?: Product[] },
    ) => {
      setCartItems((prevItems) => {
        // Determine equality: same product id and same selectedOptionIds and same extras ids
        const existingItem = prevItems.find((item) => {
          if (item.product.id !== product.id) return false
          const a = item.selectedOptionIds || []
          const b = opts?.selectedOptionIds || []
          if (a.length !== b.length) return false
          // compare values
          const sameOptions = a.every((v) => b.includes(v))
          if (!sameOptions) return false
          const extraA = (item.extras || []).map((e) => e.id).sort()
          const extraB = (opts?.extras || []).map((e) => e.id).sort()
          if (extraA.length !== extraB.length) return false
          return extraA.every((v, idx) => v === extraB[idx])
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
            selectedOptionIds: opts?.selectedOptionIds,
            extras: opts?.extras,
          }
          return [...prevItems, newCartItem]
        }
      })

      toast({
        title: 'Added to cart',
        description: `${product.name} has been added to your order.`,
      })
    },
    [toast],
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

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  const getCartTotal = useCallback(() => {
    return cartItems.reduce(
      (total, item) => total + item.product.list_price * item.quantity,
      0,
    )
  }, [cartItems])

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    updateItemNotes,
    clearCart,
    getCartTotal,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
