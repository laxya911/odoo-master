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
import { toast } from 'sonner'
import { useCompany } from '@/context/CompanyContext'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { useProducts } from '@/context/ProductContext'
import { CheckoutDialog } from './CheckoutDialog'
import { calculateItemPricing } from '@/lib/pricing-utils'
import { useTranslations } from 'next-intl'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'

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
  const t = useTranslations('cart');
  const commonT = useTranslations('common');
  const { translate } = useDynamicTranslation()
  const {
    cartItems,
    getCartTotal,
    updateItemQuantity,
    removeFromCart,
    clearCart,
    setIsCartOpen,
    isCheckoutOpen,
    setIsCheckoutOpen,
    getCartBreakdown,
  } = useCart()
  const { formatPrice } = useCompany()
  const { session } = useSession()
  const { isAuthenticated } = useAuth()
  const { taxes, defaultTaxId, currency } = useProducts()
  const router = useRouter()

  const { total, subtotal, tax } = getCartBreakdown()

  // Map to variables used in JSX
  const displaySubtotal = subtotal
  const totalTax = tax


  return (
    <>
      <div className='flex h-full flex-col bg-background/50 backdrop-blur-sm'>
        <div className='flex items-center justify-between p-6 border-b'>
          <h2 className='text-2xl font-bold flex items-center gap-2'>
            <ShoppingBag className="h-6 w-6" />
            {t('title')}
          </h2>
          {cartItems.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={clearCart}
              className='text-destructive hover:text-destructive hover:bg-destructive/10'
            >
              {t('clear')}
            </Button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className='flex flex-1 flex-col items-center justify-center gap-4 text-center p-8'>
            <div className="bg-secondary/30 p-8 rounded-full">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <p className='text-lg font-semibold'>{t('empty')}</p>
              <p className='text-sm text-muted-foreground px-8 mb-4'>
                {t('emptyDesc')}
              </p>
              <Button
                variant="outline"
                onClick={() => setIsCartOpen(false)}
                className="mt-4 border-accent-gold/50 text-accent-gold hover:bg-accent-gold/10"
              >
                {t('continue')}
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
                      alt={translate(item.product.name)}
                      fill
                      className='object-cover'
                    />
                  </div>
                  <div className='flex-1 flex flex-col justify-between'>
                    <div>
                      <div className="flex justify-between items-start">
                        <p className='font-semibold line-clamp-1 mr-2'>{translate(item.product.name)}</p>
                        <p className='font-bold text-accent-gold'>
                          {formatPrice(calculateItemPricing(item.product, item.meta, taxes, defaultTaxId, currency).totalPaid * item.quantity)}
                        </p>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {/* Attributes display */}
                        {item.meta?.attribute_value_ids?.map((vid) => {
                          let foundValName = "";
                          item.product.details?.attributes?.forEach((attr: { values: Array<{ id: number; name: string; price_extra?: number }> }) => {
                            const val = attr.values.find((v) => v.id === vid);
                            if (val) {
                              const priceMarker = val.price_extra ? ` (+${formatPrice(val.price_extra)})` : '';
                              foundValName = `${translate(val.name)}${priceMarker}`;
                            }
                          });
                          return foundValName ? (
                            <p key={vid} className="text-[10px] text-muted-foreground/80 uppercase tracking-tight">
                              • {foundValName}
                            </p>
                          ) : null;
                        })}

                        {/* Combo selections display */}
                        {item.meta?.combo_selections?.map((combo, cIdx) => {
                          const comboId = combo.combo_id || (combo as any).combo_line_id;
                          const line = item.product.combo_lines?.find((l) => l.id === comboId);

                          return (
                            <div key={cIdx} className="space-y-0.5 ml-2 mt-0.5 border-l border-accent-gold/20 pl-2">
                              {combo.product_ids.map((pid, pIdx) => {
                                const comboProd = line?.products?.find((p) => p.id === pid);
                                if (!comboProd) return null;

                                const subAttrs = combo.combo_item_attributes?.[pIdx];
                                const subSelections = combo.sub_selections?.[pIdx];

                                return (
                                  <div key={`${pid}-${pIdx}`}>
                                    <p className="text-[10px] text-accent-gold/90 italic font-medium">
                                      + {translate(comboProd.name)}
                                    </p>

                                    {/* Sub-attributes */}
                                    {subAttrs?.map((vid) => {
                                      let foundName = "";
                                      comboProd.attributes?.forEach(attr => {
                                        const val = attr.values.find(v => v.id === vid);
                                        if (val) foundName = translate(val.name);
                                      });
                                      return foundName ? (
                                        <p key={vid} className="text-[9px] text-muted-foreground/70 ml-2">
                                          └ {foundName}
                                        </p>
                                      ) : null;
                                    })}

                                    {/* Nested sub-combos */}
                                    {subSelections?.map((sub: any, sIdx: number) => {
                                      const subLine = comboProd.combo_lines?.find(l => l.id === sub.combo_id);
                                      return (
                                        <div key={sIdx} className="ml-2">
                                          {sub.product_ids.map((spid: number) => {
                                            const sp = subLine?.products?.find(p => p.id === spid);
                                            return sp ? (
                                              <p key={spid} className="text-[9px] text-accent-gold/70 italic">
                                                └ {translate(sp.name)}
                                              </p>
                                            ) : null;
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {/* Notes display */}
                        {(item.meta?.notes || item.notes) && (
                          <p className="text-[10px] text-muted-foreground italic mt-1 line-clamp-2">
                            "{item.meta?.notes || item.notes}"
                          </p>
                        )}

                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {formatPrice(calculateItemPricing(item.product, item.meta, taxes, defaultTaxId, currency).unitPrice)} {t('each')}
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
              <span className='text-muted-foreground'>{t('subtotal')}</span>
              <span>{formatPrice(displaySubtotal)}</span>
            </div>
            {totalTax > 0 && (
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>{t('tax')}</span>
                <span>{formatPrice(totalTax)}</span>
              </div>
            )}
            <Separator className="bg-accent-gold" />
            <div className='flex justify-between items-end'>
              <span className='text-lg font-semibold'>{t('total')}</span>
              <span className='text-2xl font-bold  bg-primary/10 px-3 py-1 rounded-md'>{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            size='lg'
            className='w-full font-bold text-lg shadow-xl hover:scale-[1.02] transition-all mb-3 bg-accent-gold hover:bg-accent-gold/90 text-primary uppercase tracking-wider h-14 rounded-2xl'
            disabled={cartItems.length === 0 || !session.isOpen}
            onClick={() => {
              if (!isAuthenticated) {
                toast.error(commonT('loginRequired') || 'Sign In Required', {
                  description: commonT('loginRequiredDesc') || 'Please log in or sign up to complete your checkout.',
                })
                router.push(`/auth?callbackUrl=${encodeURIComponent(window.location.href)}`)
                return
              }
              setIsCheckoutOpen(true)
            }}
          >
            {!session.isOpen ? t('closed') : t('checkout')}
          </Button>

          <Button
            variant="outline"
            className="w-full text-accent-gold border-accent-gold/30 hover:bg-accent-gold/10 font-bold transition-all h-10 rounded-xl"
            onClick={() => setIsCartOpen(false)}
          >
            {t('continue')}
          </Button>
        </div>
      </div>
    </>
  )
}
