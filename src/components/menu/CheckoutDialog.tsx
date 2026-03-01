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
    const [currentStep, setCurrentStep] = useState<CheckoutStep>('personal')
    const [placedOrderId, setPlacedOrderId] = useState<number | null>(null)
    const [placedOrderRef, setPlacedOrderRef] = useState<string | null>(null)
    // stripePromise now comes from context so it can be initialized at app startup
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [creatingPaymentIntent, setCreatingPaymentIntent] = useState(false)

    const { user, isAuthenticated } = useAuth()
    const { clearCart } = useCart()
    const router = useRouter()
    const {
      config,
      stripePromise,
      isLoading: configLoading,
    } = usePaymentConfig()

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

    // Prefill user details if authenticated
    useEffect(() => {
      if (isAuthenticated && user && isOpen) {
        form.reset({
          ...form.getValues(),
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          street: user.street || '',
          city: user.city || '',
          zip: user.zip || '',
        })
      }
    }, [isAuthenticated, user, isOpen, form])

    // Memoize cart signature to avoid unnecessary payment intent creation
    const cartSignature = useMemo(() => {
      const itemsRef = cartItems.map((i) => `${i.id}:${i.quantity}`).join('|')
      return `${itemsRef}:${Number(total).toFixed(2)}`
    }, [cartItems, total])

    // whenever the underlying cart signature changes (items/total), invalidate
    // any previously fetched client secret so we won't charge an outdated amount.
    useEffect(() => {
      if (cartSignature && clientSecret) {
        setClientSecret(null)
      }
    }, [cartSignature])

    // Create payment intent only when user reaches payment step
    const createPaymentIntent = useCallback(async () => {
      if (creatingPaymentIntent || clientSecret) return
      // nothing to charge
      if (!cartItems || cartItems.length === 0) {
        console.warn('[CheckoutDialog] createPaymentIntent skipped: cart empty')
        return
      }

      setCreatingPaymentIntent(true)

      try {
        const response = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: { items: cartItems, total, subtotal },
            customer: form.getValues(),
            orderType: form.getValues('orderType'),
            notes: form.getValues('notes'),
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
    }, [cartItems, total, subtotal, form, clientSecret, creatingPaymentIntent])

    // if dialog is opened, start creating payment intent immediately so the clientSecret
    // will hopefully be ready by the time user reaches the payment step
    useEffect(() => {
      if (isOpen && !clientSecret && !creatingPaymentIntent) {
        createPaymentIntent()
      }
    }, [
      isOpen,
      cartSignature,
      clientSecret,
      creatingPaymentIntent,
      createPaymentIntent,
    ])

    const handleStepChange = async (step: CheckoutStep) => {
      // Validate current step before moving forward
      if (step === 'details') {
        const isValid = await form.trigger(['name', 'email', 'phone'])
        if (!isValid) return
        setCurrentStep(step)
        // start fetching clientSecret in background while user fills order details
        createPaymentIntent()
      } else if (step === 'payment') {
        const isValid = await form.trigger([
          'street',
          'city',
          'zip',
          'orderType',
        ])
        if (!isValid) return
        setCurrentStep(step)
        // ensure intent exists (might already be created when entering details)
        createPaymentIntent()
      } else {
        setCurrentStep(step)
      }
    }

    const [savedPiSuffix, setSavedPiSuffix] = useState<string | null>(null)

    const handleCheckoutSuccess = () => {
      // preserve suffix before clearing the cart/secret
      const suffix = clientSecret ? clientSecret.split('_')[1]?.slice(-6) : null
      if (suffix) setSavedPiSuffix(suffix)

      setCurrentStep('success')
      clearCart()
    }

    // Poll for the created order once payment is successful
    useEffect(() => {
      let pollInterval: NodeJS.Timeout
      let attempts = 0
      const maxAttempts = 15

      if (currentStep === 'success' && !placedOrderRef) {
        const email = form.getValues('email')
        const piSuffix =
          savedPiSuffix ||
          (clientSecret ? clientSecret.split('_')[1]?.slice(-6) : null)

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
              // clear stored suffix once we have a result to avoid reuse later
              setSavedPiSuffix(null)
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

      return () => {
        if (pollInterval) clearInterval(pollInterval)
      }
    }, [currentStep, placedOrderRef, form, clientSecret])

    const handleClose = () => {
      setCurrentStep('personal')
      setPlacedOrderId(null)
      setPlacedOrderRef(null)
      setClientSecret(null)
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
          <DialogTitle className='sr-only'>Checkout</DialogTitle>

          {currentStep === 'success' ? (
            <div className='flex flex-col items-center justify-center p-12 text-center space-y-8'>
              <div className='w-24 h-24 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold shadow-inner border border-accent-gold/20'>
                <CheckCircle2 size={48} className='animate-bounce' />
              </div>
              <div className='space-y-2'>
                <h2 className='text-3xl font-serif font-bold text-neutral-900'>
                  Order Successful!
                </h2>
                <p className='text-neutral-700 max-w-sm'>
                  Thank you for your order. We've received it and are preparing
                  your culinary experience.
                </p>
                <div className='flex flex-col items-center gap-2 mt-4'>
                  <Badge
                    variant='secondary'
                    className='bg-amber-100 text-amber-900 border border-amber-200 px-4 py-1 rounded-full uppercase text-xs tracking-widest font-bold'
                  >
                    Receipt: {placedOrderRef || placedOrderId || 'Pending'}
                  </Badge>
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md pt-4'>
                <Button
                  variant='outline'
                  className='h-14 rounded-2xl border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50'
                  onClick={() => {
                    handleClose()
                    router.push(`/track/${placedOrderRef || placedOrderId}`)
                  }}
                >
                  Track Order
                </Button>
                <Button
                  variant='outline'
                  className='h-14 rounded-2xl border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50'
                  onClick={() => {
                    handleClose()
                    router.push('/profile')
                  }}
                >
                  View Profile
                </Button>
                <Button
                  className='h-14 sm:col-span-2 rounded-2xl bg-accent-gold hover:bg-amber-600 text-white font-bold text-lg shadow-lg shadow-amber-500/20'
                  onClick={handleClose}
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          ) : (
            <FormProvider {...form}>
              <div className='flex flex-col h-[90vh] md:max-h-212'>
                {/* Header with Step Indicator */}
                <div className='p-8 pb-4 bg-white z-10 border-b'>
                  <div className='flex justify-between items-center mb-6'>
                    <h2 className='text-3xl font-serif font-bold text-neutral-900 tracking-tight'>
                      Checkout
                    </h2>
                    <button
                      onClick={handleClose}
                      className='text-neutral-400 hover:text-neutral-600 transition text-xl'
                    >
                      ✕
                    </button>
                  </div>
                  {/* Step Indicator */}
                  <div className='flex items-center gap-2 text-sm'>
                    {['personal', 'details', 'payment'].map((step, idx) => (
                      <React.Fragment key={step}>
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all',
                            currentStep === step ||
                              (currentStep === 'payment' && step !== 'payment')
                              ? 'bg-accent-gold text-white'
                              : currentStep === 'details' && step === 'personal'
                                ? 'bg-accent-gold text-white'
                                : 'bg-neutral-200 text-neutral-600',
                          )}
                        >
                          {idx + 1}
                        </div>
                        {idx < 2 && (
                          <div
                            className={cn(
                              'flex-1 h-1 transition-all',
                              (currentStep === 'details' && idx === 0) ||
                                currentStep === 'payment'
                                ? 'bg-accent-gold'
                                : 'bg-neutral-200',
                            )}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Content Area */}
                <div className='flex-1 overflow-y-auto px-8 py-6 custom-scrollbar'>
                  {configLoading ? (
                    <div className='flex flex-col items-center justify-center h-full space-y-4'>
                      <Loader2 className='w-8 h-8 animate-spin text-accent-gold' />
                      <p className='text-neutral-500 font-medium'>
                        Loading checkout...
                      </p>
                    </div>
                  ) : (
                    // whatever step content we display, but wire Elements outside so it's already mounted
                    <>
                      {currentStep === 'personal' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>
                            Personal Details
                          </h3>
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                                Full Name
                              </label>
                              <input
                                {...form.register('name')}
                                placeholder='Name'
                                className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                              />
                              {form.formState.errors.name && (
                                <span className='text-xs text-red-500'>
                                  {form.formState.errors.name.message}
                                </span>
                              )}
                            </div>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                                Phone
                              </label>
                              <input
                                {...form.register('phone')}
                                placeholder='Phone'
                                className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                              />
                              {form.formState.errors.phone && (
                                <span className='text-xs text-red-500'>
                                  {form.formState.errors.phone.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                              Email Address
                            </label>
                            <input
                              type='email'
                              {...form.register('email')}
                              placeholder='Email'
                              className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                            />
                            {form.formState.errors.email && (
                              <span className='text-xs text-red-500'>
                                {form.formState.errors.email.message}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {currentStep === 'details' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>
                            Order Details
                          </h3>
                          <div className='space-y-3'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                              Order Type
                            </label>
                            <div className='grid grid-cols-3 gap-3'>
                              {['delivery', 'dine-in', 'takeout'].map(
                                (type) => (
                                  <div
                                    key={type}
                                    onClick={() =>
                                      form.setValue('orderType', type as any)
                                    }
                                    className={cn(
                                      'flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all cursor-pointer',
                                      form.watch('orderType') === type
                                        ? 'border-accent-gold bg-amber-50'
                                        : 'border-neutral-200 opacity-60 hover:border-neutral-300',
                                    )}
                                  >
                                    <span className='text-sm font-bold uppercase'>
                                      {type}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                          <div className='space-y-3'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                              Street Address
                            </label>
                            <input
                              {...form.register('street')}
                              placeholder='Street'
                              className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                            />
                            {form.formState.errors.street && (
                              <span className='text-xs text-red-500'>
                                {form.formState.errors.street.message}
                              </span>
                            )}
                          </div>
                          <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                                City
                              </label>
                              <input
                                {...form.register('city')}
                                placeholder='City'
                                className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                              />
                              {form.formState.errors.city && (
                                <span className='text-xs text-red-500'>
                                  {form.formState.errors.city.message}
                                </span>
                              )}
                            </div>
                            <div className='space-y-2'>
                              <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                                ZIP Code
                              </label>
                              <input
                                {...form.register('zip')}
                                placeholder='ZIP'
                                className='w-full h-12 px-4 rounded-xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition'
                              />
                              {form.formState.errors.zip && (
                                <span className='text-xs text-red-500'>
                                  {form.formState.errors.zip.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <label className='text-xs font-bold text-neutral-500 uppercase tracking-widest'>
                              Order Notes (Optional)
                            </label>
                            <textarea
                              {...form.register('notes')}
                              placeholder='Special instructions...'
                              className='w-full px-4 py-3 rounded-2xl border border-neutral-200 focus:border-accent-gold focus:outline-none transition h-24 resize-none'
                            />
                          </div>
                        </div>
                      )}
                      {currentStep === 'payment' && (
                        <div className='space-y-6 py-4'>
                          <h3 className='text-lg font-bold text-neutral-900'>
                            Payment
                          </h3>
                          {creatingPaymentIntent && !clientSecret && (
                            <div className='flex flex-col items-center justify-center h-48 space-y-4'>
                              <Loader2 className='w-8 h-8 animate-spin text-accent-gold' />
                              <p className='text-neutral-500 font-medium'>
                                Initializing payment...
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Elements provider mounted as soon as we have the promise and secret */}
                      {stripePromise && clientSecret && (
                        <Elements
                          stripe={stripePromise}
                          options={memoizedStripeOptions}
                        >
                          {currentStep === 'payment' && (
                            <CheckoutFormInner
                              cartItems={cartItems}
                              total={total}
                              subtotal={subtotal}
                              totalTax={totalTax}
                              provider='stripe'
                              onCancel={handleClose}
                              onSuccess={handleCheckoutSuccess}
                              inlineMode={true}
                            />
                          )}
                        </Elements>
                      )}
                    </>
                  )}
                </div>

                {/* Footer with Navigation Buttons */}
                <div className='p-8 bg-white border-t flex gap-4'>
                  <Button
                    variant='ghost'
                    type='button'
                    onClick={() =>
                      handleStepChange(
                        currentStep === 'details' ? 'personal' : 'details',
                      )
                    }
                    disabled={currentStep === 'personal'}
                    className='h-14 flex-1 font-bold text-neutral-600 rounded-2xl hover:bg-neutral-100'
                  >
                    <ArrowLeft className='w-4 h-4 mr-2' /> Back
                  </Button>
                  {currentStep !== 'payment' && (
                    <Button
                      type='button'
                      onClick={() =>
                        handleStepChange(
                          currentStep === 'personal' ? 'details' : 'payment',
                        )
                      }
                      className='h-14 flex-2 bg-accent-gold hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-lg transition-all'
                    >
                      {currentStep === 'details'
                        ? 'Proceed to Payment'
                        : 'Continue'}{' '}
                      <ArrowRight className='w-4 h-4 ml-2' />
                    </Button>
                  )}
                </div>
              </div>
            </FormProvider>
          )}
        </DialogContent>
      </Dialog>
    )
  },
)

CheckoutDialog.displayName = 'CheckoutDialog'
