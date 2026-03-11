'use client'

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import type { CartItem } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { CheckoutFormInner } from './CheckoutFormInner'
import { usePaymentConfig } from '@/context/PaymentConfigContext'
import { useSession } from '@/context/SessionContext'
import { useTranslations } from 'next-intl'

const checkoutSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z
    .string()
    .min(10, { message: 'Phone number must be at least 10 digits.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  street: z.string().min(5, { message: 'Address is required.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  zip: z.string().min(4, { message: 'Zip code is required.' }),
  orderType: z.enum(['dine-in', 'takeout', 'delivery']),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>
type CheckoutStep = 'personal' | 'details' | 'payment' | 'success'

interface CheckoutDialogProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  total: number
  subtotal: number
  totalTax: number
}

export const CheckoutDialog = memo(
  ({
    isOpen,
    onClose,
    cartItems,
    total,
    subtotal,
    totalTax,
  }: CheckoutDialogProps) => {
    const t = useTranslations('checkout');
    const cartT = useTranslations('cart');
    const [currentStep, setCurrentStep] = useState<CheckoutStep>('personal')
    const [placedOrderId, setPlacedOrderId] = useState<number | null>(null)
    const [placedOrderRef, setPlacedOrderRef] = useState<string | null>(null)
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [creatingPaymentIntent, setCreatingPaymentIntent] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    const { user, isAuthenticated, refreshUser } = useAuth()
    const { clearCart } = useCart()
    const router = useRouter()
    const {
      stripePromise,
      isLoading: configLoading,
    } = usePaymentConfig()
    const { session } = useSession()

    const form = useForm<CheckoutFormValues>({
      resolver: zodResolver(checkoutSchema),
      defaultValues: {
        name: '',
        phone: '',
        email: '',
        street: '',
        city: '',
        zip: '',
        orderType: 'delivery',
        tableNumber: '',
        notes: '',
      },
    })

    useEffect(() => {
      if (isOpen) {
        form.reset({
          name: (isAuthenticated && user?.name) || '',
          email: (isAuthenticated && user?.email) || '',
          phone: (isAuthenticated && user?.phone) || '',
          street: (isAuthenticated && user?.street) || '',
          city: (isAuthenticated && user?.city) || '',
          zip: (isAuthenticated && user?.zip) || '',
          orderType: 'delivery',
          tableNumber: '',
          notes: '',
        })
      }
    }, [isOpen, isAuthenticated, user, form])

    const cartSignature = useMemo(() => {
      const itemsRef = cartItems.map((i) => `${i.id}:${i.quantity}`).join('|')
      return `${itemsRef}:${Number(total).toFixed(2)}`
    }, [cartItems, total])

    useEffect(() => {
      if (cartSignature && clientSecret) {
        setClientSecret(null)
      }
    }, [cartSignature])

    const createPaymentIntent = useCallback(
      async (force = false) => {
        if (!force && (creatingPaymentIntent || clientSecret)) return
        if (!cartItems || cartItems.length === 0) return

        setCreatingPaymentIntent(true)
        try {
          const paymentIntentId = clientSecret ? clientSecret.split('_secret_')[0] : undefined
          const response = await fetch('/api/payment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cart: { items: cartItems, total, subtotal },
              customer: form.getValues(),
              orderType: form.getValues('orderType'),
              customer_note: form.getValues('notes'),
              paymentIntentId,
            }),
          })

          if (!response.ok) throw new Error('Failed to create payment intent')
          const data = await response.json()
          if (data.clientSecret) {
            setClientSecret(data.clientSecret)
          }
        } catch (err) {
          console.error('Payment intent creation failed:', err)
        } finally {
          setCreatingPaymentIntent(false)
        }
      },
      [cartItems, total, subtotal, form, clientSecret, creatingPaymentIntent]
    )

    const handleStepChange = async (step: CheckoutStep) => {
      if (step === 'details') {
        const isValid = await form.trigger(['name', 'email', 'phone'])
        if (!isValid) return
        setCurrentStep(step)
      } else if (step === 'payment') {
        const isValid = await form.trigger(['street', 'city', 'zip', 'orderType'])
        if (!isValid) return
        setCurrentStep(step)
        createPaymentIntent(true)
      } else {
        setCurrentStep(step)
      }
    }

    const [savedPiSuffix, setSavedPiSuffix] = useState<string | null>(null)
    const { setIsCartOpen } = useCart()

    const handleCheckoutSuccess = () => {
      const suffix = clientSecret ? clientSecret.split('_')[1]?.slice(-6) : null
      if (suffix) setSavedPiSuffix(suffix)
      setClientSecret(null)
      setCurrentStep('success')
      clearCart()
      setIsCartOpen(false)
    }

    useEffect(() => {
      let pollInterval: NodeJS.Timeout
      let attempts = 0
      const maxAttempts = 15

      if (currentStep === 'success' && !placedOrderRef) {
        const email = form.getValues('email')
        const piSuffix = savedPiSuffix || (clientSecret ? clientSecret.split('_')[1]?.slice(-6) : null)

        const poll = async () => {
          try {
            const query = piSuffix
              ? `name=${encodeURIComponent(`Online Order - ${piSuffix}`)}`
              : `limit=1&email=${encodeURIComponent(email)}`

            const res = await fetch(`/api/odoo/restaurant/pos-orders?${query}`)
            const result = await res.json()

            if (result.data && result.data.length > 0) {
              const latestOrder = result.data[0]
              setPlacedOrderId(latestOrder.id)
              setPlacedOrderRef(latestOrder.pos_reference)
              setSavedPiSuffix(null)
              refreshUser()
              clearInterval(pollInterval)
            }
          } catch (err) {
            console.error('Polling error:', err)
          }
          attempts++
          if (attempts >= maxAttempts) clearInterval(pollInterval)
        }
        pollInterval = setInterval(poll, 3000)
        poll()
      }
      return () => { if (pollInterval) clearInterval(pollInterval) }
    }, [currentStep, placedOrderRef, form, clientSecret, savedPiSuffix, refreshUser])

    const handleClose = () => {
      setCurrentStep('personal')
      setPlacedOrderId(null)
      setPlacedOrderRef(null)
      setClientSecret(null)
      form.reset({
        name: (isAuthenticated && user?.name) || '',
        email: (isAuthenticated && user?.email) || '',
        phone: (isAuthenticated && user?.phone) || '',
        street: (isAuthenticated && user?.street) || '',
        city: (isAuthenticated && user?.city) || '',
        zip: (isAuthenticated && user?.zip) || '',
        orderType: 'delivery',
        tableNumber: '',
        notes: '',
      })
      onClose()
    }

    const memoizedStripeOptions = useMemo(
      () => ({
        clientSecret: clientSecret || '',
        appearance: { theme: 'stripe' as const },
      }),
      [clientSecret],
    )

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className='max-w-2xl w-full p-0 overflow-hidden border-none shadow-2xl rounded-4xl bg-white text-neutral-900'>
          <DialogTitle className='sr-only'>{t('title')}</DialogTitle>

          {currentStep === 'success' ? (
            <div className='flex flex-col items-center justify-center p-12 text-center space-y-8 bg-neutral-950 text-white min-h-[500px]'>
              <div className='w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner border border-amber-500/20'>
                <CheckCircle2 size={48} className='animate-pulse' />
              </div>
              <div className='space-y-4'>
                <h2 className='text-4xl font-serif font-bold text-white tracking-tight'>{t('success')}</h2>
                <p className='text-neutral-300 max-w-sm mx-auto text-lg leading-relaxed'>{t('successDesc')}</p>
                <div className='flex flex-col items-center gap-2 mt-6'>
                  <div className='bg-neutral-900 border border-neutral-800 px-6 py-2 rounded-2xl'>
                    <span className='text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] block mb-1'>{t('receipt')}</span>
                    <span className='text-amber-500 font-mono font-bold text-lg'>
                      {placedOrderRef || placedOrderId || '...'}
                    </span>
                  </div>
                </div>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md pt-4'>
                <Button variant='outline' className='h-14 rounded-2xl border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50'
                  onClick={() => { handleClose(); const trackingId = placedOrderId || placedOrderRef; if (trackingId) router.push(`/track/${trackingId}`) }}>
                  {t('track')}
                </Button>
                <Button variant='outline' className='h-14 rounded-2xl border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50'
                  onClick={() => { handleClose(); router.push('/profile') }}>
                  {t('profile')}
                </Button>
                <Button className='h-14 sm:col-span-2 rounded-2xl bg-accent-gold hover:bg-amber-600 text-white font-bold text-lg shadow-lg shadow-amber-500/20'
                  onClick={handleClose}>
                  {cartT('continue')}
                </Button>
              </div>
            </div>
          ) : (
            <FormProvider {...form}>
              <div className='flex flex-col h-[90vh] md:max-h-212'>
                {/* Header */}
                <div className='p-6 pb-2 bg-white z-10 border-b flex items-center justify-between'>
                  <div className='flex flex-col'>
                    <h2 className='text-2xl font-serif font-bold text-neutral-900 tracking-tight'>{t('title')}</h2>
                    <p className='text-[10px] text-neutral-400 font-bold uppercase tracking-widest'>
                      {t('step', { step: currentStep === 'personal' ? '1' : currentStep === 'details' ? '2' : '3' })}
                    </p>
                  </div>
                </div>

                {/* Step Indicator */}
                <div className='px-6 pt-3 flex items-center gap-2 text-sm bg-white'>
                  {['personal', 'details', 'payment'].map((step, idx) => (
                    <React.Fragment key={step}>
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                        currentStep === step || (currentStep === 'payment' && step !== 'payment') || (currentStep === 'details' && step === 'personal')
                          ? 'bg-accent-gold text-white' : 'bg-neutral-100 text-neutral-400'
                      )}>
                        {idx + 1}
                      </div>
                      {idx < 2 && (
                        <div className={cn(
                          'flex-1 h-0.5 transition-all',
                          (currentStep === 'details' && idx === 0) || currentStep === 'payment' ? 'bg-accent-gold' : 'bg-neutral-100'
                        )} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Content Area */}
                <div className='flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-white'>
                  {configLoading ? (
                    <div className='flex flex-col items-center justify-center h-full space-y-4'>
                      <Loader2 className='w-8 h-8 animate-spin text-accent-gold' />
                      <p className='text-neutral-500 font-medium'>{t('loading')}</p>
                    </div>
                  ) : (
                    <>
                      {currentStep === 'personal' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>{t('personal')}</h3>
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('name')}</label>
                              <input {...form.register('name')} placeholder={t('name')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                              {form.formState.errors.name && <span className='text-xs text-red-500'>{form.formState.errors.name.message}</span>}
                            </div>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('phone')}</label>
                              <input {...form.register('phone')} placeholder={t('phone')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                              {form.formState.errors.phone && <span className='text-xs text-red-500'>{form.formState.errors.phone.message}</span>}
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('email')}</label>
                            <input type='email' {...form.register('email')} placeholder={t('email')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                            {form.formState.errors.email && <span className='text-xs text-red-500'>{form.formState.errors.email.message}</span>}
                          </div>
                        </div>
                      )}

                      {currentStep === 'details' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>{t('order')}</h3>
                          <div className='space-y-3'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('orderType')}</label>
                            <div className='grid grid-cols-3 gap-3'>
                              {['delivery', 'dine-in', 'takeout'].map((type) => (
                                <div key={type} onClick={() => form.setValue('orderType', type as any)}
                                  className={cn('flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all cursor-pointer',
                                    form.watch('orderType') === type ? 'border-accent-gold bg-amber-50' : 'border-neutral-200 opacity-60 hover:border-neutral-300')}>
                                  <span className='text-sm font-bold uppercase'>{type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className='space-y-3'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('street')}</label>
                            <input {...form.register('street')} placeholder={t('street')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                            {form.formState.errors.street && <span className='text-xs text-red-500'>{form.formState.errors.street.message}</span>}
                          </div>
                          <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('city')}</label>
                              <input {...form.register('city')} placeholder={t('city')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                              {form.formState.errors.city && <span className='text-xs text-red-500'>{form.formState.errors.city.message}</span>}
                            </div>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('zip')}</label>
                              <input {...form.register('zip')} placeholder={t('zip')} className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition' />
                              {form.formState.errors.zip && <span className='text-xs text-red-500'>{form.formState.errors.zip.message}</span>}
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>{t('notes')}</label>
                            <textarea {...form.register('notes')} placeholder={t('placeholderNotes')} className='w-full px-4 py-3 rounded-2xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition h-24 resize-none' />
                          </div>
                        </div>
                      )}

                      {currentStep === 'payment' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>{t('payment')}</h3>
                          {creatingPaymentIntent && !clientSecret && (
                            <div className='flex flex-col items-center justify-center h-48 space-y-4'>
                              <Loader2 className='w-8 h-8 animate-spin text-accent-gold' />
                              <p className='text-neutral-500 font-medium'>{t('initPayment')}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {stripePromise && clientSecret && (
                        <Elements stripe={stripePromise} options={memoizedStripeOptions}>
                          <div className={cn(currentStep === 'payment' ? 'block' : 'hidden')}>
                            <CheckoutFormInner
                              cartItems={cartItems}
                              total={total}
                              subtotal={subtotal}
                              totalTax={totalTax}
                              provider='stripe'
                              onCancel={handleClose}
                              onSuccess={handleCheckoutSuccess}
                              inlineMode={true}
                              isProcessing={isProcessing}
                              setIsProcessing={setIsProcessing}
                            />
                          </div>
                        </Elements>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className='p-6 bg-white border-t flex gap-3'>
                  <Button variant='ghost' type='button' disabled={currentStep === 'personal'}
                    onClick={() => handleStepChange(currentStep === 'details' ? 'personal' : 'details')}
                    className='h-12 flex-1 font-bold text-neutral-500 rounded-xl hover:bg-neutral-50 border border-neutral-100'>
                    <ArrowLeft className='w-4 h-4 mr-2' /> {t('back')}
                  </Button>
                  {currentStep === 'payment' ? (
                    <Button type='submit' form='checkout-form' disabled={!session?.isOpen || isProcessing}
                      className='h-12 flex-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-base transition-all group'>
                      {isProcessing ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' /> {t('processing')}
                        </>
                      ) : (
                        <>
                          {t('completePay')} <ArrowRight className='w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform' />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button type='button' onClick={() => handleStepChange(currentStep === 'personal' ? 'details' : 'payment')}
                      className='h-12 flex-2 bg-accent-gold hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-base transition-all'>
                      {currentStep === 'details' ? t('proceedPayment') : t('continue')} <ArrowRight className='w-4 h-4 ml-2' />
                    </Button>
                  )}
                </div>
              </div>
            </FormProvider>
          )}
        </DialogContent>
      </Dialog>
    )
  }
)

CheckoutDialog.displayName = 'CheckoutDialog'
