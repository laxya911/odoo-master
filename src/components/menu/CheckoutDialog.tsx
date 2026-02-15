'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { createOrder } from '@/lib/actions'
import { formatCurrency } from '@/lib/utils'
import type {
  CartItem,
  OrderPayload,
  OrderLineItem,
  CustomerDetails,
} from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { Separator } from '../ui/separator'

const checkoutSchema = z.object({
  orderType: z.enum(['dine-in', 'delivery']),
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  paymentMethod: z.enum(['cash', 'online_demo']),
  // delivery fields (optional here; UI can show/hide and we perform minimal validation client-side)
  street: z.string().optional(),
  street2: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>

type CheckoutDialogProps = {
  isOpen: boolean
  onClose: () => void
  onCheckoutSuccess: (orderId: number) => void
  cartItems: CartItem[]
  total: number
  subtotal?: number
  totalTax?: number
}

export function CheckoutDialog({
  isOpen,
  onClose,
  onCheckoutSuccess,
  cartItems,
  total,
  subtotal = 0,
  totalTax = 0,
}: CheckoutDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      orderType: 'dine-in',
      name: '',
      email: '',
      paymentMethod: 'cash',
      street2: '',
      phone: '',
    },
  })

  const orderType = form.watch('orderType')

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsSubmitting(true)
    try {
      const orderLines: OrderLineItem[] = cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        list_price: item.product.list_price,
        notes: item.notes,
      }))

      let customerDetails: CustomerDetails = {
        name: data.name,
        email: data.email,
      }

      if (data.orderType === 'delivery') {
        customerDetails = {
          ...customerDetails,
          street: data.street,
          street2: data.street2,
          city: data.city,
          zip: data.zip,
          country: data.country,
          phone: data.phone,
        }
      }

      const payload: OrderPayload = {
        orderLines,
        customer: customerDetails,
        paymentMethod: data.paymentMethod,
        orderType: data.orderType,
        total,
      }

      const result = await createOrder(payload)

      if (result.success && result.orderId) {
        onCheckoutSuccess(result.orderId)
        form.reset()
      } else {
        toast({
          variant: 'destructive',
          title: 'Checkout Failed',
          description: result.message || 'An unknown error occurred.',
        })
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast({
        variant: 'destructive',
        title: 'Checkout Failed',
        description: 'Could not place the order. Please try again later.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='p-0 max-w-md'>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col h-full'
        >
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Please provide your details to proceed.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content Area */}
          <div className='overflow-y-auto flex-1 px-6 py-4'>
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Label>Order Type</Label>
                <Controller
                  control={form.control}
                  name='orderType'
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='flex gap-4'
                    >
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='dine-in' id='dine-in' />
                        <Label htmlFor='dine-in'>Dine In</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='delivery' id='delivery' />
                        <Label htmlFor='delivery'>Delivery</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <Separator />

              <div className='grid gap-2'>
                <Label htmlFor='name'>Full Name</Label>
                <Input id='name' {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className='text-sm text-destructive'>
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='email'>Email Address</Label>
                <Input id='email' type='email' {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className='text-sm text-destructive'>
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {orderType === 'delivery' && (
                <>
                  <div className='grid gap-2'>
                    <Label htmlFor='street'>Street Address</Label>
                    <Input id='street' {...form.register('street')} />
                    {form.formState.errors.street && (
                      <p className='text-sm text-destructive'>
                        {form.formState.errors.street.message}
                      </p>
                    )}
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='street2'>Address Line 2</Label>
                    <Input id='street2' {...form.register('street2')} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='city'>City</Label>
                    <Input id='city' {...form.register('city')} />
                    {form.formState.errors.city && (
                      <p className='text-sm text-destructive'>
                        {form.formState.errors.city.message}
                      </p>
                    )}
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='zip'>ZIP Code</Label>
                    <Input id='zip' {...form.register('zip')} />
                    {form.formState.errors.zip && (
                      <p className='text-sm text-destructive'>
                        {form.formState.errors.zip.message}
                      </p>
                    )}
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='country'>Country</Label>
                    <Input id='country' {...form.register('country')} />
                    {form.formState.errors.country && (
                      <p className='text-sm text-destructive'>
                        {form.formState.errors.country.message}
                      </p>
                    )}
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='phone'>Phone</Label>
                    <Input id='phone' {...form.register('phone')} />
                  </div>
                </>
              )}

              <Separator />

              <div className='grid gap-2'>
                <Label>Payment Method</Label>
                <Controller
                  control={form.control}
                  name='paymentMethod'
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='mt-2 space-y-2'
                    >
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='cash' id='cash' />
                        <Label htmlFor='cash'>Cash (Demo)</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='online_demo' id='online_demo' />
                        <Label htmlFor='online_demo'>Online (Demo)</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
                {form.formState.errors.paymentMethod && (
                  <p className='text-sm text-destructive'>
                    {form.formState.errors.paymentMethod.message}
                  </p>
                )}
              </div>

              <Separator />

              {/* Order Summary */}
              <div className='space-y-2 bg-muted p-3 rounded'>
                <h3 className='font-semibold text-sm'>Order Summary</h3>
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalTax > 0 && (
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>Tax</span>
                    <span>{formatCurrency(totalTax)}</span>
                  </div>
                )}
                <Separator />
                <div className='flex justify-between font-bold text-base'>
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting || cartItems.length === 0}
              className='bg-green-600 hover:bg-green-700 text-white'
            >
              {isSubmitting && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              Place Order ({formatCurrency(total)})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
