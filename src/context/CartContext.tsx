"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Product, CartItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateItemQuantity: (cartItemId: string, quantity: number) => void;
  updateItemNotes: (cartItemId: string, notes: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCartItems((prevItems) => {
      // For simple products, check if it's already in the cart
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        // If it exists, just update the quantity
        return prevItems.map((item) =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // If it's a new product, add it to the cart
        const newCartItem: CartItem = {
          id: crypto.randomUUID(),
          product,
          quantity,
        };
        return [...prevItems, newCartItem];
      }
    });

    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your order.`,
    });
  }, [toast]);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== cartItemId)
    );
  }, []);

  const updateItemQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
    } else {
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.id === cartItemId ? { ...item, quantity } : item
        )
      );
    }
  }, [removeFromCart]);
  
  const updateItemNotes = useCallback((cartItemId: string, notes: string) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === cartItemId ? { ...item, notes } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce(
      (total, item) => total + item.product.list_price * item.quantity,
      0
    );
  }, [cartItems]);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    updateItemNotes,
    clearCart,
    getCartTotal,
  };

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}