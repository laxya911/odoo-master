'use client'

import React, { useState, useEffect, useMemo, memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'


import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { CartItem, PaymentProvider } from '@/lib/types'
import { useCompany } from '@/context/CompanyContext'
import { useSession } from '@/context/SessionContext'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { CheckoutFormInner } from './CheckoutFormInner'
import type { PaymentConfigResponse } from '@/lib/types'

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
  paymentMethod: z.custom<PaymentProvider>((val) => {
    return typeof val === 'string' && ['stripe', 'razorpay', 'paypal', 'demo_online'].includes(val);
  }, { message: "Invalid payment method" }),
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>

interface CheckoutDialogProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  total: number
  subtotal: number
  totalTax: number
}

const CheckoutDialog = memo(({
  isOpen,
  onClose,
  cartItems,
  total,
  subtotal,
  totalTax,
}: CheckoutDialogProps) => {
  const [isSuccess, setIsSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null)
  const [placedOrderRef, setPlacedOrderRef] = useState<string | null>(null)
  const [config, setConfig] = useState<PaymentConfigResponse | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null)

  const { user, isAuthenticated } = useAuth()
  const { clearCart } = useCart()
  const router = useRouter()

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
      paymentMethod: 'demo_online' as PaymentProvider,
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
      });
    }
  }, [isAuthenticated, user, isOpen, form]);

  // Fetch Payment Configuration on dialog open
  useEffect(() => {
    if (isOpen && !config) {
      fetch('/api/payment/config')
        .then(res => res.json())
        .then((data: PaymentConfigResponse) => {
          if (data && data.provider) {
            setConfig(data);
            if (data.provider === 'stripe' && data.public_key) {
              setStripePromise(loadStripe(data.public_key));
            }
          }
        })
        .catch(err => console.error("Failed to load payment config", err));
    }
  }, [isOpen]);

  // Generate Payment Intent on unmount / config load
  useEffect(() => {
    if (isOpen && config?.provider === 'stripe' && !clientSecret && cartItems.length > 0) {
      fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: { items: cartItems, total, subtotal },
          customer: form.getValues(),
          orderType: form.getValues('orderType')
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          }
        })
        .catch(err => console.error("Failed to create payment intent", err));
    }
  }, [isOpen, config, cartItems, total, subtotal, form, user]);

  const handleCheckoutSuccess = () => {
    // In strict webhook architecture, UI success means payment was captured/processed by SDK.
    // Order creation is handled in the background by webhook.
    setIsSuccess(true)
    clearCart()
  }

  // Poll for the created order once payment is successful
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 15; // 15 * 3s = 45s max polling

    if (isSuccess && !placedOrderRef) {
      const email = form.getValues('email');
      // Extract payment intent suffix if clientSecret is available
      const piSuffix = clientSecret ? clientSecret.split('_')[1]?.slice(-6) : null;

      const poll = async () => {
        try {
          const query = piSuffix
            ? `name=${encodeURIComponent(`Online Order - ${piSuffix}`)}`
            : `limit=1&email=${encodeURIComponent(email)}`;

          const res = await fetch(`/api/odoo/restaurant/pos-orders?${query}`);
          const result = await res.json();

          if (result.data && result.data.length > 0) {
            const latestOrder = result.data[0];
            setPlacedOrderId(latestOrder.id);
            setPlacedOrderRef(latestOrder.pos_reference);
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
        }
      };

      pollInterval = setInterval(poll, 3000);
      poll(); // Initial check
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isSuccess, placedOrderRef, form, user]);

  const handleClose = () => {
    if (isSuccess) {
      setIsSuccess(false)
      setPlacedOrderId(null)
      setPlacedOrderRef(null)
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn('max-w-2xl w-full p-0 overflow-hidden border-none shadow-2xl rounded-[32px]', isSuccess ? 'bg-neutral-900 border border-white/10' : 'bg-white text-neutral-900')}>
        <DialogTitle className="sr-only">Checkout</DialogTitle>
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center p-12 text-center space-y-8"
            >
              <div className="w-24 h-24 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold shadow-inner border border-accent-gold/20">
                <CheckCircle2 size={48} className="animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-bold text-white">Order Successful!</h2>
                <p className="text-white/70 max-w-sm">Thank you for your order. We've received it and are preparing your culinary experience.</p>
                <div className="flex flex-col items-center gap-2 mt-4">
                  <Badge variant="secondary" className="bg-white/10 text-accent-gold border border-white/20 px-4 py-1 rounded-full uppercase text-xs tracking-widest font-bold">
                    Receipt: {placedOrderRef || placedOrderId || 'Pending'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md pt-4">
                <Button variant="outline" className="h-14 rounded-2xl border-white/20 bg-transparent text-white font-bold hover:bg-white/10" onClick={() => { handleClose(); router.push(`/track/${placedOrderRef || placedOrderId}`); }}>
                  Track Order
                </Button>
                <Button variant="outline" className="h-14 rounded-2xl border-white/20 bg-transparent text-white font-bold hover:bg-white/10" onClick={() => { handleClose(); router.push('/profile'); }}>
                  View Profile
                </Button>
                <Button className="h-14 sm:col-span-2 rounded-2xl bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold text-lg shadow-lg shadow-accent-gold/20" onClick={handleClose}>
                  Continue Shopping
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full relative"
            >
              <FormProvider {...form}>
                {!config ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-accent-gold" />
                    <p className="text-neutral-500 font-medium">Securing checkout...</p>
                  </div>
                ) : config.provider === 'stripe' ? (
                  clientSecret && stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutFormInner
                        cartItems={cartItems}
                        total={total}
                        subtotal={subtotal}
                        totalTax={totalTax}
                        provider={config.provider}
                        onCancel={handleClose}
                        onSuccess={handleCheckoutSuccess}
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center p-24">
                      <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
                    </div>
                  )
                ) : (
                  <CheckoutFormInner
                    cartItems={cartItems}
                    total={total}
                    subtotal={subtotal}
                    totalTax={totalTax}
                    provider={config.provider}
                    onCancel={handleClose}
                    onSuccess={handleCheckoutSuccess}
                  />
                )}
              </FormProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
})

CheckoutDialog.displayName = 'CheckoutDialog';
export { CheckoutDialog };
