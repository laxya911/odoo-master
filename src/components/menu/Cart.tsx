'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useCart } from '@/context/CartContext'
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { useCompany } from '@/context/CompanyContext'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
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
    clearCart,
    setIsCartOpen,
  } = useCart()
  const [isCheckoutOpen, setCheckoutOpen] = useState(false)
  const [productTaxes, setProductTaxes] = useState<
    Record<number, ProductTaxData>
  >({})
  const { toast } = useToast()
  const { formatPrice } = useCompany()
  const { session } = useSession()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const subtotal = getCartTotal()

  // Fetch taxes for all products in cart
  useEffect(() => {
    if (cartItems.length === 0) return

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

  // Calculate tax for a product (treating price as tax-included)
  const calculateItemTax = (
    productId: number,
    quantity: number,
    price: number,
  ): number => {
    const taxData = productTaxes[productId]
    if (!taxData || taxData.taxes.length === 0) return 0

    let totalTax = 0
    for (const tax of taxData.taxes) {
      if (typeof tax.amount === 'number') {
        const rate = tax.amount / 100
        // We treat ALL prices as tax-included for the customer's view.
        // Tax Amount = Total - (Total / (1 + rate))
        // This is valid whether Odoo thinks it's included or not, because we want
        // the list_price to be the FINAL price.
        const lineTotal = price * quantity
        const taxAmount = lineTotal - lineTotal / (1 + rate)
        totalTax += taxAmount
      }
    }
    return Number(totalTax.toFixed(2))
  }

  // Calculate total tax for all items
  const totalTax = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const itemTax = calculateItemTax(
        item.product.id,
        item.quantity,
        item.product.list_price,
      )
      return sum + itemTax
    }, 0)
  }, [cartItems, calculateItemTax])


  // In this new logic, getCartTotal() returns the sum of list_prices, which IS the final total.
  const total = subtotal
  // The displayed "Subtotal" should now be the Pre-Tax amount
  const displaySubtotal = total - totalTax

  // const handleNoteChange = useDebouncedCallback(
  //   (cartItemId: string, notes: string) => {
  //     updateItemNotes(cartItemId, notes)
  //   },
  //   500,
  // )


  return (
    <>
      <div className='flex h-full flex-col bg-background/50 backdrop-blur-sm'>
        <div className='flex items-center justify-between p-6 border-b'>
          <h2 className='text-2xl font-bold flex items-center gap-2'>
            <ShoppingBag className="h-6 w-6" />
            Your Order
          </h2>
          {cartItems.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={clearCart}
              className='text-destructive hover:text-destructive hover:bg-destructive/10'
            >
              Clear All
            </Button>
          )}
          {/* <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCartOpen(false)}
            className="rounded-full hover:bg-secondary/50"
          >
            <X className="h-5 w-5" />
          </Button> */}
        </div>

        {cartItems.length === 0 ? (
          <div className='flex flex-1 flex-col items-center justify-center gap-4 text-center p-8'>
            <div className="bg-secondary/30 p-8 rounded-full">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <p className='text-lg font-semibold'>Your cart is empty.</p>
              <p className='text-sm text-muted-foreground px-8 mb-4'>
                Looks like you haven't added anything to your cart yet.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsCartOpen(false)}
                className="mt-4 border-accent-gold/50 text-accent-gold hover:bg-accent-gold/10"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className='flex-1'>
            <div className='space-y-6 p-6'>
              {cartItems.map((item) => (
                <div key={item.id} className='group flex gap-4 p-2 rounded-xl hover:bg-secondary/30 transition-colors border border-transparent hover:border-border/50'>
                  <div className='relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-secondary/10 -ml-1'>
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
                  <div className='flex-1 flex flex-col justify-between'>
                    <div>
                      <div className="flex justify-between items-start">
                        <p className='font-semibold line-clamp-1 mr-2'>{item.product.name}</p>
                        <p className='font-bold text-accent-gold'>
                          {formatPrice(item.product.list_price * item.quantity)}
                        </p>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {/* Attributes display */}
                        {item.meta?.attribute_value_ids?.map((vid) => {
                          // Try to find the value name in ANY attribute of the product
                          // product.details.attributes is the usual place in this project
                          let foundValName = "";
                          item.product.details?.attributes?.forEach((attr: { values: Array<{ id: number; name: string; price_extra?: number }> }) => {
                            const val = attr.values.find((v) => v.id === vid);
                            if (val) {
                              const priceMarker = val.price_extra ? ` (+${formatPrice(val.price_extra)})` : '';
                              foundValName = `${val.name}${priceMarker}`;
                            }
                          });
                          return foundValName ? (
                            <p key={vid} className="text-[10px] text-muted-foreground/80 uppercase tracking-tight">
                              • {foundValName}
                            </p>
                          ) : null;
                        })}

                        {/* Combo selections display */}
                        {item.meta?.combo_selections?.map((combo, cIdx) => (
                          <div key={cIdx}>
                            {combo.product_ids.map((pid) => {
                              // Find the product in the combo line
                              const line = item.product.combo_lines?.find((l) => l.id === combo.combo_line_id);
                              const comboProd = line?.products?.find((p) => p.id === pid);
                              return comboProd ? (
                                <p key={pid} className="text-[10px] text-accent-gold/80 italic">
                                  + {comboProd.name}
                                </p>
                              ) : null;
                            })}
                          </div>
                        ))}

                        {/* Notes display */}
                        {(item.meta?.notes || item.notes) && (
                          <p className="text-[10px] text-muted-foreground italic mt-1 line-clamp-2">
                            "{item.meta?.notes || item.notes}"
                          </p>
                        )}

                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {formatPrice(item.product.list_price)} each
                        </p>
                      </div>
                    </div>

                    <div className='flex items-center justify-between mt-3'>
                      <div className='flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5 border border-border/50'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7 rounded-md'
                          onClick={() =>
                            updateItemQuantity(item.id, item.quantity - 1)
                          }
                        >
                          <Minus className='h-3 w-3' />
                        </Button>
                        <span className='w-8 text-center font-bold text-sm'>
                          {item.quantity}
                        </span>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7 rounded-md'
                          onClick={() =>
                            updateItemQuantity(item.id, item.quantity + 1)
                          }
                        >
                          <Plus className='h-3 w-3' />
                        </Button>
                      </div>

                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity'
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className='mt-auto border-t bg-card px-2 pt-2 pb-6 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]'>
          <div className='space-y-2 mb-4'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Subtotal</span>
              <span>{formatPrice(displaySubtotal)}</span>
            </div>
            {totalTax > 0 && (
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Tax</span>
                <span>{formatPrice(totalTax)}</span>
              </div>
            )}
            <Separator className="bg-accent-gold" />
            <div className='flex justify-between items-end'>
              <span className='text-lg font-semibold'>Total</span>
              <span className='text-2xl font-bold  bg-primary/10 px-3 py-1 rounded-md'>{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            size='lg'
            className='w-full font-bold text-lg shadow-xl hover:scale-[1.02] transition-all mb-3 bg-accent-gold hover:bg-accent-gold/90 text-primary uppercase tracking-wider h-14 rounded-2xl'
            disabled={cartItems.length === 0 || !session.isOpen}
            onClick={() => {
              if (!isAuthenticated) {
                toast({
                  title: 'Sign In Required',
                  description: 'Please log in or sign up to complete your checkout.',
                })
                router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`)
                return
              }
              setCheckoutOpen(true)
            }}
          >
            {!session.isOpen ? 'Store Closed' : 'Checkout'}
          </Button>

          <Button
            variant="outline"
            className="w-full text-accent-gold border-accent-gold/30 hover:bg-accent-gold/10 font-bold transition-all h-10 rounded-xl"
            onClick={() => setIsCartOpen(false)}
          >
            Continue Shopping
          </Button>
        </div>
      </div>
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cartItems={cartItems}
        total={total}
        subtotal={displaySubtotal}
        totalTax={totalTax}
      />
    </>
  )
}
