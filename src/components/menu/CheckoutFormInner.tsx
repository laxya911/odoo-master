import React, { useState, memo } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useFormContext, Controller } from 'react-hook-form';
import { Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCompany } from '@/context/CompanyContext';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/hooks/use-toast';
import type { CartItem, PaymentProvider } from '@/lib/types';

interface CheckoutFormInnerProps {
    cartItems: CartItem[];
    total: number;
    subtotal: number;
    totalTax: number;
    onCancel: () => void;
    onSuccess: () => void;
    provider: PaymentProvider;
}

export const CheckoutFormInner = memo(({
    cartItems,
    total,
    totalTax,
    onCancel,
    onSuccess,
    provider
}: CheckoutFormInnerProps) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const { formatPrice } = useCompany();
    const { session } = useSession();
    const { toast } = useToast();

    // These map to the parent's Form Provider
    const form = useFormContext();

    const stripe = useStripe();
    const elements = useElements();

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Trigger form validation first
        const isValid = await form.trigger();
        if (!isValid) return;

        if (!session.isOpen) {
            toast({
                title: 'Store Closed',
                description: 'Orders cannot be placed while the store is closed.',
                variant: 'destructive',
            });
            return;
        }

        setIsProcessing(true);

        try {
            if (provider === 'stripe') {
                if (!stripe || !elements) {
                    throw new Error("Stripe has not loaded properly.");
                }

                // 2. Submit elements first (Stripe requirement)
                const { error: submitError } = await elements.submit();
                if (submitError) {
                    throw submitError;
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
                    redirect: 'if_required'
                });

                if (result.error) {
                    throw new Error(result.error.message || 'Payment failed');
                }

                if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'processing' || result.paymentIntent?.status === 'requires_capture') {
                    // Payment confirmed, webhook handles order generation
                    toast({
                        title: 'Payment Received',
                        description: 'Your payment was successful. Generating order...',
                    });
                    onSuccess();
                }

            } else if (provider === 'demo_online') {
                // Fallback simulation
                await new Promise(resolve => setTimeout(resolve, 1500));
                onSuccess();
            }

        } catch (error: any) {
            console.error('Payment Error:', error);
            toast({
                title: 'Payment Failed',
                description: error.message || 'There was an issue processing your payment.',
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form id="checkout-form" onSubmit={handlePaymentSubmit} className="flex flex-col h-[90vh] md:max-h-[850px]">
            <div className="p-8 pb-4 bg-white z-10 border-b flex items-center justify-between">
                <h2 className="text-3xl font-serif font-bold text-neutral-900 tracking-tight flex items-center gap-3">
                    <ShoppingBag className="h-7 w-7 text-amber-500" />
                    Checkout
                </h2>
            </div>

            <ScrollArea className="flex-1 px-8 py-4 custom-scrollbar bg-white">
                <div className="space-y-10 py-6">
                    {/* Order Summary */}
                    <section className="bg-neutral-50 rounded-3xl p-6 border border-neutral-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Order Summary</h3>
                        </div>
                        <div className="space-y-3">
                            {cartItems.map((item) => (
                                <div key={item.id} className="flex justify-between items-center">
                                    <p className="text-sm font-medium text-neutral-800">
                                        <span className="font-bold text-amber-600">{item.quantity}×</span> {item.product.name}
                                    </p>
                                    <span className="text-sm font-bold text-neutral-900">{formatPrice(item.product.list_price * item.quantity)}</span>
                                </div>
                            ))}
                            <Separator className="bg-neutral-200/50 my-2" />
                            <div className="flex justify-between items-end">
                                <p className="text-2xl font-bold text-amber-600">{formatPrice(total)}</p>
                                <p className="text-[10px] text-neutral-400 font-medium">Incl. Tax {formatPrice(totalTax)}</p>
                            </div>
                        </div>
                    </section>

                    {/* Personal Info */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-1 w-8 bg-amber-500 rounded-full" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-800">1. Personal Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Full Name</Label>
                                <Input {...form.register('name')} placeholder="Name" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Phone Number</Label>
                                <Input {...form.register('phone')} placeholder="Phone" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Email Address</Label>
                            <Input type="email" {...form.register('email')} placeholder="Email" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                        </div>
                    </div>

                    {/* Logistics */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-1 w-8 bg-amber-500 rounded-full" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-800">2. Order Details</h3>
                        </div>

                        <Controller
                            control={form.control}
                            name="orderType"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                                    {['delivery', 'dine-in', 'takeout'].map((type) => (
                                        <div key={type} onClick={() => field.onChange(type)} className={cn(
                                            "flex flex-col items-center justify-center p-3 border-2 rounded-2xl transition-all cursor-pointer",
                                            field.value === type ? "border-amber-500 bg-amber-50" : "border-neutral-100 opacity-60"
                                        )}>
                                            <span className="text-[10px] font-bold uppercase">{type}</span>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}
                        />

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Street Address</Label>
                                <Input {...form.register('street')} placeholder="Street" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">City</Label>
                                    <Input {...form.register('city')} placeholder="City" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">ZIP Code</Label>
                                    <Input {...form.register('zip')} placeholder="ZIP" className="bg-white border-neutral-200 focus:border-amber-500 h-12 rounded-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Order Notes</Label>
                            <Textarea {...form.register('notes')} placeholder="Instructions..." className="bg-white border-neutral-200 focus:border-amber-500 rounded-2xl h-24" />
                        </div>
                    </div>

                    {/* Payment Element */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-1 w-8 bg-amber-500 rounded-full" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-800">3. Payment</h3>
                        </div>
                        <div className="bg-neutral-900 rounded-[32px] p-6 text-white space-y-6 shadow-xl">
                            {provider === 'stripe' && stripe && elements ? (
                                <PaymentElement options={{ layout: 'tabs' }} className="theme-dark" />
                            ) : (
                                <div className="text-center py-6 text-neutral-400 text-sm">
                                    {provider === 'demo_online' ? 'Demo mode: Click Place Order to simulate payment.' : 'Loading payment element...'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <footer className="p-8 bg-white border-t flex gap-4 rounded-b-[32px] z-20">
                <Button variant="ghost" type="button" onClick={onCancel} disabled={isProcessing} className="h-14 flex-1 font-bold text-neutral-400 rounded-2xl">
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={!session.isOpen || isProcessing}
                    className="h-14 flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-lg transition-all"
                >
                    {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "Place Order"}
                </Button>
            </footer>
        </form>
    );
});
