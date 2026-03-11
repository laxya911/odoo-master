import React, { useState, memo } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { useFormContext, Controller } from 'react-hook-form'
import { Loader2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useCompany } from '@/context/CompanyContext'
import { useSession } from '@/context/SessionContext'
import { toast } from 'sonner'
import type { CartItem, PaymentProvider } from '@/lib/types'
import { useTranslations } from 'next-intl'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'

interface CheckoutFormInnerProps {
  cartItems: CartItem[]
  total: number
  subtotal: number
  totalTax: number
  onCancel: () => void
  onSuccess: () => void
  provider: PaymentProvider
  inlineMode?: boolean
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
}

const CheckoutFormInnerBase = ({
  cartItems,
  total,
  totalTax,
  onCancel,
  onSuccess,
  provider,
  inlineMode,
  isProcessing,
  setIsProcessing,
}: CheckoutFormInnerProps) => {

  const { formatPrice } = useCompany()
  const { session } = useSession()
  const t = useTranslations('checkout')
  const cartT = useTranslations('cart')
  const commonT = useTranslations('common')
  const { translate } = useDynamicTranslation()

  // These map to the parent's Form Provider
  const form = useFormContext()

  const stripe = useStripe()
  const elements = useElements()

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Trigger form validation first
    const isValid = await form.trigger()
    if (!isValid) return

    if (!session.isOpen) {
      toast.error(cartT('closed') || 'Store Closed', {
        description: commonT('storeClosedDesc') || 'Orders cannot be placed while the store is closed.',
      })
      return
    }

    setIsProcessing(true)

    try {
      if (provider === 'stripe') {
        if (!stripe || !elements) {
          throw new Error('Stripe has not loaded properly.')
        }

        // 2. Submit elements first (Stripe requirement)
        const { error: submitError } = await elements.submit()
        if (submitError) {
          throw submitError
        }

        // 3. Confirm Payment
        // Since we are not redirecting to a new page, keeping user in the modal
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            // For now, redirecting to the current window location to complete if 3D secure is required,
            // but for typical flows, we might handle it without wide redirects if possible.
            // Using a `return_url` is required by standard Stripe web elements.
            return_url: `${window.location.origin}/track?success=true`,
          },
          redirect: 'if_required',
        })

        if (result.error) {
          throw new Error(result.error.message || 'Payment failed')
        }

        if (
          result.paymentIntent?.status === 'succeeded' ||
          result.paymentIntent?.status === 'processing' ||
          result.paymentIntent?.status === 'requires_capture'
        ) {
          // Payment confirmed, webhook handles order generation
          toast.success(commonT('paymentReceived') || 'Payment Received', {
            description: commonT('paymentSuccessDesc') || 'Your payment was successful. Generating order...',
          })
          onSuccess()
        }
      }
    } catch (error: any) {
      console.error('Payment Error:', error)
      toast.error(commonT('paymentFailed') || 'Payment Failed', {
        description: error.message || 'There was an issue processing your payment.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form
      id='checkout-form'
      onSubmit={handlePaymentSubmit}
      className='flex flex-col flex-1 overflow-hidden'
    >
      {inlineMode ? (
        // Inline payment-only mode (used in multi-step wizard)
        <div className='grow flex flex-col'>
          <div className='bg-neutral-900 rounded-2xl p-4 text-white shadow-xl min-h-[300px] flex flex-col justify-center border border-white/5'>
            {provider === 'stripe' && stripe && elements ? (
              <div className="animate-in fade-in duration-500">
                <PaymentElement
                  className='theme-dark'
                  options={{
                    layout: 'tabs', // More compact for modals
                  }}
                />
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center py-12 space-y-4'>
                <Loader2 className='h-8 w-8 animate-spin text-amber-500' />
                <span className='text-neutral-400 text-xs font-bold uppercase tracking-widest'>
                  {t('initPayment')}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Full checkout form (original layout)
        <>
          <div className='p-8 pb-4 bg-white z-10 border-b flex items-center justify-between'>
            <h2 className='text-3xl font-serif font-bold text-neutral-900 tracking-tight flex items-center gap-3'>
              <ShoppingBag className='h-7 w-7 text-amber-500' />
              {t('title')}
            </h2>
          </div>

          <ScrollArea className='flex-1 px-8 py-4 custom-scrollbar bg-white'>
            <div className='space-y-10 py-6'>
              {/* Order Summary */}
              <section className='bg-neutral-50 rounded-3xl p-6 border border-neutral-100 shadow-sm'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-xs font-bold uppercase tracking-[0.2em] text-neutral-400'>
                    {t('orderSummary') || 'Order Summary'}
                  </h3>
                </div>
                <div className='space-y-3'>
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className='flex justify-between items-center'
                    >
                      <p className='text-sm font-medium text-neutral-800'>
                        <span className='font-bold text-amber-600'>
                          {item.quantity}×
                        </span>{' '}
                        {translate(item.product.name)}
                      </p>
                      <span className='text-sm font-bold text-neutral-900'>
                        {formatPrice(item.product.list_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <Separator className='bg-neutral-200/50 my-2' />
                  <div className='flex justify-between items-end'>
                    <p className='text-2xl font-bold text-amber-600'>
                      {formatPrice(total)}
                    </p>
                    <p className='text-[10px] text-neutral-400 font-medium'>
                      {commonT('inclTax') || 'Incl. Tax'} {formatPrice(totalTax)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Personal Info */}
              <div className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <div className='h-1 w-8 bg-amber-500 rounded-full' />
                  <h3 className='text-sm font-bold uppercase tracking-widest text-neutral-800'>
                    1. {t('personal')}
                  </h3>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-1.5'>
                    <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                      {t('name')}
                    </Label>
                    <Input
                      {...form.register('name')}
                      placeholder={t('name')}
                      className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                      {t('phone')}
                    </Label>
                    <Input
                      {...form.register('phone')}
                      placeholder={t('phone')}
                      className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                    />
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                    {t('email')}
                  </Label>
                  <Input
                    type='email'
                    {...form.register('email')}
                    placeholder={t('email')}
                    className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                  />
                </div>
              </div>

              {/* Logistics */}
              <div className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <div className='h-1 w-8 bg-amber-500 rounded-full' />
                  <h3 className='text-sm font-bold uppercase tracking-widest text-neutral-800'>
                    2. {t('order')}
                  </h3>
                </div>

                <Controller
                  control={form.control}
                  name='orderType'
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='grid grid-cols-3 gap-2'
                    >
                      {['delivery', 'dine-in', 'takeout'].map((type) => (
                        <div
                          key={type}
                          onClick={() => field.onChange(type)}
                          className={cn(
                            'flex flex-col items-center justify-center p-3 border-2 rounded-2xl transition-all cursor-pointer',
                            field.value === type
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-neutral-100 opacity-60',
                          )}
                        >
                          <span className='text-[10px] font-bold uppercase'>
                            {type}
                          </span>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />

                <div className='space-y-4 pt-2'>
                  <div className='space-y-1.5'>
                    <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                      {t('street')}
                    </Label>
                    <Input
                      {...form.register('street')}
                      placeholder={t('street')}
                      className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                        {t('city')}
                      </Label>
                      <Input
                        {...form.register('city')}
                        placeholder={t('city')}
                        className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                        {t('zip')}
                      </Label>
                      <Input
                        {...form.register('zip')}
                        placeholder={t('zip')}
                        className='bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl'
                      />
                    </div>
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <Label className='text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1'>
                    {t('notes')}
                  </Label>
                  <Textarea
                    {...form.register('notes')}
                    placeholder={t('placeholderNotes')}
                    className='bg-white border-neutral-200 focus:border-amber-500 rounded-2xl h-24'
                  />
                </div>
              </div>

              {/* Payment Element */}
              <div className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <div className='h-1 w-8 bg-amber-500 rounded-full' />
                  <h3 className='text-sm font-bold uppercase tracking-widest text-neutral-800'>
                    3. {t('payment')}
                  </h3>
                </div>
                <div className='bg-neutral-900 rounded-4xl p-6 text-white space-y-6 shadow-xl'>
                  {provider === 'stripe' && stripe && elements ? (
                    <PaymentElement className='theme-dark' />
                  ) : (
                    <div className='text-center py-6 text-neutral-400 text-sm'>
                      {t('loading') || 'Securing payment gateway...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <footer className='p-8 bg-white border-t flex gap-4 rounded-b-4xl z-20'>
            <Button
              variant='ghost'
              type='button'
              onClick={onCancel}
              disabled={isProcessing}
              className='h-14 flex-1 font-bold text-neutral-400 rounded-2xl'
            >
              {commonT('cancel') || 'Cancel'}
            </Button>
            <Button
              type='submit'
              disabled={!session.isOpen || isProcessing}
              className='h-14 flex-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-lg transition-all'
            >
              {isProcessing ? (
                <Loader2 className='h-6 w-6 animate-spin' />
              ) : (
                t('completePay') || 'Place Order'
              )}
            </Button>
          </footer>
        </>
      )}
    </form>
  )
}

export const CheckoutFormInner = memo(CheckoutFormInnerBase)
CheckoutFormInner.displayName = 'CheckoutFormInner'
