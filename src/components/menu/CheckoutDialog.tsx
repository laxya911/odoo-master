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
import type { CartItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
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
    },
  });

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createOrder({
        cartItems,
        customer: { name: data.name, email: data.email },
        paymentMethod: data.paymentMethod,
        total,
      });

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
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>
              Please provide your details and select a payment method.
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
               <Label>Payment Method</Label>
               <RadioGroup
                  onValueChange={(value) => form.setValue('paymentMethod', value as 'demo' | 'stripe')}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="demo" id="demo" />
                    <Label htmlFor="demo">Demo Checkout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="stripe" id="stripe" />
                    <Label htmlFor="stripe">Stripe (Test)</Label>
                  </div>
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
