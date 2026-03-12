'use client'

import React, { useState } from 'react'
import { useCart } from '@/context/CartContext'
import { useCompany } from '@/context/CompanyContext'
import { useProducts } from '@/context/ProductContext'
import { useSession } from '@/context/SessionContext'
import { useAuth } from '@/context/AuthContext'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'
import { useTranslations } from 'next-intl'
import { calculateItemPricing } from '@/lib/pricing-utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ShoppingBag, X, Plus, Minus, Trash2, ChevronRight, ShoppingCart, ArrowLeft,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const CheckoutDialog = dynamic(
  () => import('@/components/menu/CheckoutDialog').then((m) => ({ default: m.CheckoutDialog })),
  { ssr: false }
)

export default function CartPage() {
  const t = useTranslations('cart')
  const commonT = useTranslations('common')
  const { translate } = useDynamicTranslation()
  const { formatPrice } = useCompany()
  const { taxes, defaultTaxId } = useProducts()
  const { session } = useSession()
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const {
    cartItems,
    updateItemQuantity,
    updateItemNotes,
    removeFromCart,
    clearCart,
    getCartBreakdown,
    isCheckoutOpen,
    setIsCheckoutOpen,
  } = useCart()

  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const { total, subtotal, tax } = getCartBreakdown()

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.error(commonT('loginRequired'), {
        description: commonT('loginRequiredDesc'),
      })
      router.push(`/auth?callbackUrl=${encodeURIComponent('/cart')}`)
      return
    }
    setIsCheckoutOpen(true)
  }

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8">
          <ShoppingBag className="w-10 h-10 text-white/30" />
        </div>
        <h1 className="text-3xl font-display font-bold text-white mb-3">{t('empty')}</h1>
        <p className="text-white/50 mb-8 max-w-xs">{t('emptyDesc')}</p>
        <Link href="/menu">
          <Button className="bg-accent-gold text-primary font-bold px-8 py-3 rounded-full hover:bg-white transition-all">
            {t('continue')}
          </Button>
        </Link>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-neutral-950 pt-28 pb-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/menu" className="p-2 text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">{t('title')}</h1>
              <p className="text-white/40 text-sm mt-1">
                {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="ml-auto text-red-400/70 hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('clear')}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => {
                const pricing = calculateItemPricing(item.product, item.meta, taxes, defaultTaxId)
                return (
                  <div
                    key={item.id}
                    className="bg-neutral-900/60 border border-white/5 rounded-3xl p-5 flex gap-4 hover:border-accent-gold/20 transition-all"
                  >
                    {/* Image */}
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                      <Image
                        src={
                          item.product.image_256
                            ? `data:image/png;base64,${item.product.image_256}`
                            : '/images/placeholder-food.jpg'
                        }
                        alt={translate(item.product.name)}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-white text-base line-clamp-1">
                          {translate(item.product.name)}
                        </p>
                        <p className="text-accent-gold font-bold text-base flex-shrink-0">
                          {formatPrice(pricing.totalPaid * item.quantity)}
                        </p>
                      </div>
                      <p className="text-white/40 text-xs mt-0.5">
                        {formatPrice(pricing.unitPrice)} {t('each')}
                      </p>

                      {/* Attributes display */}
                      {item.meta?.attribute_value_ids && item.meta.attribute_value_ids.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.meta.attribute_value_ids.map((vid) => {
                            let name = ''
                            item.product.details?.attributes?.forEach((attr: any) => {
                              const v = attr.values.find((v: any) => v.id === vid)
                              if (v) name = translate(v.name)
                            })
                            return name ? (
                              <span key={vid} className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded-full">
                                {name}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}

                      {/* Notes */}
                      {editingNotes === item.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            autoFocus
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            placeholder="Note for kitchen..."
                            className="flex-1 text-xs bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-gold/50"
                          />
                          <Button
                            size="sm"
                            className="bg-accent-gold text-primary text-xs h-8 px-3 rounded-lg font-bold"
                            onClick={() => {
                              updateItemNotes(item.id, notesDraft)
                              setEditingNotes(null)
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setNotesDraft(item.notes || item.meta?.notes || '')
                            setEditingNotes(item.id)
                          }}
                          className="mt-2 text-[11px] text-white/30 hover:text-accent-gold transition-colors"
                        >
                          {item.notes || item.meta?.notes
                            ? `📝 "${item.notes || item.meta?.notes}"`
                            : '+ Add note for kitchen'}
                        </button>
                      )}
                    </div>

                    {/* Qty Controls */}
                    <div className="flex flex-col items-end justify-between flex-shrink-0 gap-3">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/5">
                        <button
                          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-white w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-neutral-900/60 border border-white/5 rounded-3xl p-6">
                <h2 className="text-lg font-bold text-white mb-6">{t('checkout')}</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">{t('subtotal')}</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">{t('tax')}</span>
                      <span className="text-white">{formatPrice(tax)}</span>
                    </div>
                  )}
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-end">
                    <span className="text-white font-bold">{t('total')}</span>
                    <span className="text-2xl font-bold text-accent-gold">{formatPrice(total)}</span>
                  </div>
                </div>

                <Button
                  size="lg"
                  disabled={!session.isOpen}
                  onClick={handleCheckout}
                  className="w-full bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold rounded-2xl h-14 text-base shadow-lg shadow-accent-gold/20 mt-2"
                >
                  {!session.isOpen ? t('closed') : t('checkout')}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>

                <Link href="/menu">
                  <Button
                    variant="ghost"
                    className="w-full mt-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl h-10 text-sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t('continue')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        total={total}
        subtotal={subtotal}
        totalTax={tax}
      />
    </>
  )
}
