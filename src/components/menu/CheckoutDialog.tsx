"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { createOrder } from '@/lib/actions';
import type { CartItem, OrderPayload, OrderLineItem, CustomerDetails } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  address: z.string().min(5, 'Please enter a valid address.'),
  city: z.string().min(2, 'Please enter a valid city.'),
  zip: z.string().min(3, 'Please enter a valid ZIP/postal code.'),
  country: z.string().min(2, 'Please enter a valid country.'),
  paymentMethod: z.enum(['demo', 'stripe'], {
    required_error: 'You need to select a payment method.',
  }),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type CheckoutDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCheckoutSuccess: (orderId: number) => void;
  cartItems: CartItem[];
  total: number;
};

export function CheckoutDialog({
  isOpen,
  onClose,
  onCheckoutSuccess,
  cartItems,
  total
}: CheckoutDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: '',
      email: '',
      address: '',
      city: '',
      zip: '',
      country: '',
    },
  });

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsSubmitting(true);
    try {
      const lineItems: OrderLineItem[] = cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        list_price: item.product.list_price,
        notes: item.notes,
      }));
      
      const customerDetails: CustomerDetails = {
        name: data.name,
        email: data.email,
        address: data.address,
        city: data.city,
        zip: data.zip,
        country: data.country
      }

      const payload: OrderPayload = {
        cartItems: lineItems,
        customer: customerDetails,
        paymentMethod: data.paymentMethod,
        total,
      };
      
      const result = await createOrder(payload);

      if (result.success && result.orderId) {
        onCheckoutSuccess(result.orderId);
        form.reset();
      } else {
        toast({
          variant: 'destructive',
          title: 'Checkout Failed',
          description: result.message || 'An unknown error occurred.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Checkout Failed',
        description: 'Could not place the order. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Complete Your Delivery Order</DialogTitle>
            <DialogDescription>
              Please provide your details for delivery and payment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
             <div className="grid gap-2">
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" {...form.register('address')} />
              {form.formState.errors.address && (
                <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...form.register('city')} />
                {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">ZIP / Postal Code</Label>
                <Input id="zip" {...form.register('zip')} />
                {form.formState.errors.zip && <p className="text-sm text-destructive">{form.formState.errors.zip.message}</p>}
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...form.register('country')} />
              {form.formState.errors.country && (
                <p className="text-sm text-destructive">{form.formState.errors.country.message}</p>
              )}
            </div>
            <div className="grid gap-2">
               <Label>Payment Method</Label>
               <RadioGroup
                  onValueChange={(value) => form.setValue('paymentMethod', value as 'demo' | 'stripe')}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="demo" id="demo" />
                    <Label htmlFor="demo">Online Payment (Demo)</Label>
                  </div>
                   {/* Stripe could be added here later */}
                </RadioGroup>
                {form.formState.errors.paymentMethod && (
                    <p className="text-sm text-destructive">{form.formState.errors.paymentMethod.message}</p>
                )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Place Order ({new Intl.NumberFormat("en-US", { style: "currency", currency: "USD"}).format(total)})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
