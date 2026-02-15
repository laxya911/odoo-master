'use client'
import React from 'react'
import { CartProvider } from '@/context/CartContext'
import { Cart } from '@/components/menu/Cart'
import { Toaster } from '@/components/ui/toaster'

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <div className='flex min-h-screen w-full '>
        <main className='flex-1 p-4 sm:p-6 lg:p-8'>{children}</main>
        <aside className='hidden w-full max-w-sm border-l bg-muted/40 lg:block'>
          <div className='sticky top-0 h-screen'>
            <Cart />
          </div>
        </aside>
      </div>
      <Toaster />
    </CartProvider>
  )
}
