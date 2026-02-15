'use client'

import React, { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import Image from 'next/image'
import { Minus, Plus, X } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { CheckoutDialog } from './CheckoutDialog'

interface ProductTaxData {
  product_id: number
  taxes: Array<{
    id: number
    name: string
    amount: number
    price_include: boolean
  }>
}

export function Cart() {
  const {
    cartItems,
    getCartTotal,
    updateItemQuantity,
    removeFromCart,
    updateItemNotes,
    clearCart,
  } = useCart()
  const [isCheckoutOpen, setCheckoutOpen] = useState(false)
  const [productTaxes, setProductTaxes] = useState<
    Record<number, ProductTaxData>
  >({})
  const { toast } = useToast()
  const subtotal = getCartTotal()

  // Fetch taxes for all products in cart
  useEffect(() => {
    if (cartItems.length === 0) {
      setProductTaxes({})
      return
    }

    const productIds = Array.from(
      new Set(cartItems.map((item) => item.product.id)),
    )
    const idsParam = productIds.join(',')

    fetch(`/api/odoo/product-taxes?ids=${idsParam}`)
      .then((r) => r.json())
      .then((data) => {
        const taxMap: Record<number, ProductTaxData> = {}
        if (data.data) {
          for (const item of data.data) {
            taxMap[item.product_id] = item
          }
        }
        setProductTaxes(taxMap)
      })
      .catch((err) => console.error('Failed to fetch product taxes:', err))
  }, [cartItems])

  // Calculate tax for a product
  const calculateItemTax = (
    productId: number,
    quantity: number,
    price: number,
  ): number => {
    const taxData = productTaxes[productId]
    if (!taxData || taxData.taxes.length === 0) return 0

    let totalTax = 0
    for (const tax of taxData.taxes) {
      if (typeof tax.amount === 'number' && !tax.price_include) {
        const rate = tax.amount / 100
        totalTax += price * quantity * rate
      }
    }
    return Number(totalTax.toFixed(2))
  }

  // Calculate total tax for all items
  const totalTax = cartItems.reduce((sum, item) => {
    const itemTax = calculateItemTax(
      item.product.id,
      item.quantity,
      item.product.list_price,
    )
    return sum + itemTax
  }, 0)

  const total = subtotal + totalTax

  const handleNoteChange = useDebouncedCallback(
    (cartItemId: string, notes: string) => {
      updateItemNotes(cartItemId, notes)
    },
    500,
  )

  const handleCheckoutSuccess = (orderId: number) => {
    setCheckoutOpen(false)
    clearCart()
    toast({
      title: 'Order Placed!',
      description: `Your order #${orderId} has been created successfully.`,
    })
  }

  return (
    <>
      <div className='flex h-full flex-col'>
        <div className='flex items-center justify-between p-6'>
          <h2 className='text-2xl font-bold'>My Order</h2>
          {cartItems.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={clearCart}
              className='text-destructive hover:text-destructive'
            >
              Clear All
            </Button>
          )}
        </div>
        <Separator />

        {cartItems.length === 0 ? (
          <div className='flex flex-1 flex-col items-center justify-center gap-4 text-center'>
            <p className='text-muted-foreground'>Your cart is empty.</p>
            <p className='text-sm text-muted-foreground'>
              Add items from the menu to get started.
            </p>
          </div>
        ) : (
          <ScrollArea className='flex-1'>
            <div className='space-y-4 p-6'>
              {cartItems.map((item) => (
                <div key={item.id} className='flex gap-4'>
                  <div className='relative h-20 w-20 shrink-0 overflow-hidden rounded-md'>
                    <Image
                      src={
                        item.product.image_256
                          ? `data:image/png;base64,${item.product.image_256}`
                          : 'https://picsum.photos/seed/fooditem/100'
                      }
                      alt={item.product.name}
                      fill
                      className='object-cover'
                    />
                  </div>
                  <div className='flex-1'>
                    <p className='font-semibold'>{item.product.name}</p>
                    <p className='text-sm font-bold text-muted-foreground'>
                      {formatCurrency(item.product.list_price)}
                    </p>
                    <div className='mt-2 flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() =>
                          updateItemQuantity(item.id, item.quantity - 1)
                        }
                      >
                        <Minus className='h-4 w-4' />
                      </Button>
                      <span className='w-8 text-center font-bold'>
                        {item.quantity}
                      </span>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() =>
                          updateItemQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Plus className='h-4 w-4' />
                      </Button>
                    </div>
                    <Input
                      type='text'
                      placeholder='Add a note...'
                      defaultValue={item.notes}
                      onChange={(e) =>
                        handleNoteChange(item.id, e.target.value)
                      }
                      className='mt-2 text-sm h-9 text-foreground placeholder:text-muted-foreground'
                    />
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive'
                    onClick={() => removeFromCart(item.id)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className='mt-auto border-t p-6 space-y-3'>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {totalTax > 0 && (
            <>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Tax</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <Separator />
            </>
          )}
          <div className='flex justify-between text-lg font-bold'>
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <Button
            size='lg'
            className='w-full mt-4'
            disabled={cartItems.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            Proceed to Checkout
          </Button>
        </div>
      </div>
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onCheckoutSuccess={handleCheckoutSuccess}
        cartItems={cartItems}
        total={total}
        subtotal={subtotal}
        totalTax={totalTax}
      />
    </>
  )
}
