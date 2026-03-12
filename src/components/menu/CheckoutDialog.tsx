'use client'

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, CreditCard, Smartphone, ExternalLink } from 'lucide-react'
import type { CartItem } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

const checkoutSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  street: z.string().min(5, { message: 'Address is required.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  zip: z.string().min(4, { message: 'Zip code is required.' }),
  orderType: z.enum(['dine-in', 'takeout', 'delivery']),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>
type CheckoutStep = 'personal' | 'details' | 'payment'
type PaymentProviderChoice = 'stripe' | 'razorpay'

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
    const t = useTranslations('checkout')
    const [currentStep, setCurrentStep] = useState<CheckoutStep>('personal')
    const [selectedProvider, setSelectedProvider] = useState<PaymentProviderChoice>('stripe')
    const [isRedirecting, setIsRedirecting] = useState(false)

    const { user, isAuthenticated } = useAuth()
    const { clearCart } = useCart()
    const router = useRouter()
    const { session } = useSession()

    const form = useForm<CheckoutFormValues>({
      resolver: zodResolver(checkoutSchema),
      defaultValues: {
        name: '', phone: '', email: '',
        street: '', city: '', zip: '',
        orderType: 'delivery', tableNumber: '', notes: '',
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
        setCurrentStep('personal')
        setIsRedirecting(false)
      }
    }, [isOpen, isAuthenticated, user, form])

    const handleStepChange = async (step: CheckoutStep) => {
      if (step === 'details') {
        const isValid = await form.trigger(['name', 'email', 'phone'])
        if (!isValid) return
      } else if (step === 'payment') {
        const isValid = await form.trigger(['street', 'city', 'zip', 'orderType'])
        if (!isValid) return
      }
      setCurrentStep(step)
    }

    const handlePayNow = useCallback(async () => {
      if (!session?.isOpen) return
      setIsRedirecting(true)
      try {
        const values = form.getValues()
        const response = await fetch(`/api/payment/create-session?provider=${selectedProvider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: { items: cartItems, total, subtotal },
            customer: {
              name: values.name,
              email: values.email,
              phone: values.phone,
              street: values.street,
              city: values.city,
              zip: values.zip,
            },
            orderType: values.orderType,
            customer_note: values.notes,
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to create payment session')
        }

        const { url } = await response.json()
        if (!url) throw new Error('No payment URL received')

        // Redirect to hosted checkout
        window.location.href = url
      } catch (error: any) {
        console.error('Payment session error:', error)
        toast.error('Payment Error', { description: error.message })
        setIsRedirecting(false)
      }
    }, [cartItems, total, subtotal, form, selectedProvider, session])

    const handleClose = () => {
      setCurrentStep('personal')
      setIsRedirecting(false)
      form.reset()
      onClose()
    }

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className='max-w-2xl w-full p-0 overflow-hidden border-none shadow-2xl rounded-4xl bg-white text-neutral-900'>
          <DialogTitle className='sr-only'>{t('title')}</DialogTitle>

          <FormProvider {...form}>
            <div className='flex flex-col h-[90vh] md:max-h-212'>
              {/* Header */}
              <div className='p-6 pb-2 bg-white z-10 border-b flex items-center justify-between'>
                <div>
                  <h2 className='text-2xl font-serif font-bold text-neutral-900'>{t('title')}</h2>
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

              {/* Content */}
              <div className='flex-1 overflow-y-auto px-8 py-6 bg-white'>
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
                    <p className='text-sm text-neutral-500'>Select your preferred payment method. You will be redirected to a secure hosted checkout page.</p>

                    <div className='space-y-3'>
                      {/* Stripe Option */}
                      <div
                        onClick={() => setSelectedProvider('stripe')}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all',
                          selectedProvider === 'stripe' ? 'border-accent-gold bg-amber-50' : 'border-neutral-200 hover:border-neutral-300'
                        )}
                      >
                        <div className='w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0'>
                          <CreditCard className='w-6 h-6 text-white' />
                        </div>
                        <div className='flex-1'>
                          <p className='font-bold text-neutral-900'>{t('cardMethod')}</p>
                          <p className='text-xs text-neutral-500 mt-0.5'>{t('cardMethodDesc')}</p>
                        </div>
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all',
                          selectedProvider === 'stripe' ? 'border-accent-gold bg-accent-gold' : 'border-neutral-300'
                        )} />
                      </div>

                      {/* Razorpay Option */}
                      <div
                        onClick={() => setSelectedProvider('razorpay')}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all',
                          selectedProvider === 'razorpay' ? 'border-accent-gold bg-amber-50' : 'border-neutral-200 hover:border-neutral-300'
                        )}
                      >
                        <div className='w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0'>
                          <Smartphone className='w-6 h-6 text-white' />
                        </div>
                        <div className='flex-1'>
                          <p className='font-bold text-neutral-900'>Razorpay</p>
                          <p className='text-xs text-neutral-500 mt-0.5'>UPI, Cards, Netbanking — ideal for India</p>
                        </div>
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all',
                          selectedProvider === 'razorpay' ? 'border-accent-gold bg-accent-gold' : 'border-neutral-300'
                        )} />
                      </div>
                    </div>

                    <div className='bg-neutral-50 rounded-2xl p-4 text-xs text-neutral-500 flex items-start gap-2'>
                      <ExternalLink className='w-4 h-4 flex-shrink-0 mt-0.5' />
                      <span>{t('securityPitch')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className='p-6 bg-white border-t flex gap-3'>
                <Button
                  variant='ghost'
                  type='button'
                  disabled={currentStep === 'personal'}
                  onClick={() => handleStepChange(currentStep === 'payment' ? 'details' : 'personal')}
                  className='h-12 flex-1 font-bold text-neutral-500 rounded-xl hover:bg-neutral-50 border border-neutral-100'
                >
                  <ArrowLeft className='w-4 h-4 mr-2' /> {t('back')}
                </Button>

                {currentStep === 'payment' ? (
                  <Button
                    type='button'
                    disabled={!session?.isOpen || isRedirecting}
                    onClick={handlePayNow}
                    className='h-12 flex-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-base transition-all group'
                  >
                    {isRedirecting ? (
                      <>
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' /> {t('redirecting')}
                      </>
                    ) : (
                      <>
                        {t('completePay')} <ArrowRight className='w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform' />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type='button'
                    onClick={() => handleStepChange(currentStep === 'personal' ? 'details' : 'payment')}
                    className='h-12 flex-2 bg-accent-gold hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-base transition-all'
                  >
                    {currentStep === 'details' ? t('proceedPayment') : t('continue')}
                    <ArrowRight className='w-4 h-4 ml-2' />
                  </Button>
                )}
              </div>
            </div>
          </FormProvider>
        </DialogContent>
      </Dialog>
    )
  }
)

CheckoutDialog.displayName = 'CheckoutDialog'
