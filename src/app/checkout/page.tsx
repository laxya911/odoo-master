"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Truck, CheckCircle, Package, Loader2, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { PaymentGateway } from '@/components/restaurant/PaymentGateway';

// Checkout flow is handled via Stripe Hosted Session or Odoo POS direct (cash)

export default function CheckoutPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { cartItems: items, getCartTotal, clearCart } = useCart();
    const { user } = useAuth();
    const { formatPrice } = useCompany();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('card');

    const [address, setAddress] = useState({
        street: user?.street || '',
        city: user?.city || '',
        zip: user?.zip || '',
        phone: user?.phone || '',
        country: 'India'
    });

    useEffect(() => {
        if (user) {
            setAddress(prev => ({
                ...prev,
                street: user.street || prev.street,
                city: user.city || prev.city,
                zip: user.zip || prev.zip,
                phone: user.phone || prev.phone
            }));
        }
    }, [user]);

    const total = getCartTotal();

    const handlePlaceOrder = async () => {
        setIsProcessing(true);
        try {
            // If card, redirect to Stripe. If cash, go direct (or to a specialized flow).
            if (paymentMethod === 'card') {
                const response = await fetch('/api/stripe/checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderLines: items.map(item => ({
                            product_id: item.product.id,
                            quantity: item.quantity,
                            list_price: item.product.list_price,
                            notes: item.notes || ''
                        })),
                        customer: {
                            ...address,
                            name: user?.name || 'Guest',
                            email: user?.email || 'guest@example.com',
                        }
                    })
                });

                const data = await response.json();
                if (data.url) {
                    window.location.href = data.url; // Redirect to Stripe
                    return;
                } else {
                    throw new Error(data.error || 'Failed to initialize checkout session');
                }
            } else {
                // Cash Order Flow
                const response = await fetch('/api/odoo/restaurant/pos-orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderLines: items.map(item => ({
                            product_id: item.product.id,
                            quantity: item.quantity,
                            list_price: item.product.list_price,
                            notes: item.notes || ''
                        })),
                        customer: {
                            ...address,
                            name: user?.name || 'Guest',
                            email: user?.email || 'guest@example.com',
                        },
                        paymentMethod: 'cash',
                        orderType: 'delivery'
                    })
                });

                if (!response.ok) throw new Error('Failed to create cash order');

                toast({
                    title: "Order Placed Successfully",
                    description: "Please pay on delivery.",
                });
                clearCart();
                router.push('/track/latest');
            }
        } catch (error) {
            const err = error as Error;
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };


    if (items.length === 0) {
        return (
            <div className="container mx-auto px-4 py-32 text-center">
                <Package className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
                <h1 className="text-3xl font-bold mb-4">Your bag is empty</h1>
                <Button onClick={() => router.push('/menu')} variant="default" className="rounded-full px-8 h-12">Return to Menu</Button>
            </div>
        );
    }

    if (isProcessing) {
        return (
            <div className="container mx-auto px-4 py-40 text-center animate-in fade-in zoom-in duration-500">
                <div className="relative w-32 h-32 mx-auto mb-12">
                    <div className="absolute inset-0 bg-accent-gold/20 rounded-full animate-ping" />
                    <div className="relative bg-accent-gold text-white w-32 h-32 rounded-full flex items-center justify-center shadow-2xl">
                        <Loader2 className="w-16 h-16 animate-spin" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold mb-4 font-headline">Preparing Secure Checkout...</h1>
                <p className="text-xl text-muted-foreground max-w-md mx-auto">
                    Redirecting you to our secure payment gateway. This will only take a moment.
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-24 max-w-6xl">
            <h1 className="text-4xl lg:text-6xl font-bold mb-12 font-headline">Finish your <span className="text-accent-gold">Order</span></h1>

            <div className="flex flex-col lg:flex-row gap-12">
                <div className="flex-1 space-y-12">
                    {/* Step 1: Delivery Address */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-accent-gold text-white w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-lg">1</div>
                            <h2 className="text-2xl font-bold font-headline uppercase tracking-wider">Delivery Address</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 lg:p-12 bg-white rounded-[3rem] shadow-sm border border-accent-gold/5">
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs uppercase tracking-widest font-bold opacity-50">Street Address</Label>
                                <Input
                                    placeholder="3-3-16 Minami-cho, Suite 1F"
                                    className="rounded-2xl h-14 bg-neutral-50 border-none focus-visible:ring-accent-gold"
                                    value={address.street}
                                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest font-bold opacity-50">City</Label>
                                <Input
                                    placeholder="Mito City"
                                    className="rounded-2xl h-14 bg-neutral-50 border-none focus-visible:ring-accent-gold"
                                    value={address.city}
                                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest font-bold opacity-50">Postal Code</Label>
                                <Input
                                    placeholder="310-0021"
                                    className="rounded-2xl h-14 bg-neutral-50 border-none focus-visible:ring-accent-gold"
                                    value={address.zip}
                                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest font-bold opacity-50">Phone Number</Label>
                                <Input
                                    placeholder="029-XXXX-XXXX"
                                    className="rounded-2xl h-14 bg-neutral-50 border-none focus-visible:ring-accent-gold"
                                    value={address.phone}
                                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Step 2: Payment Method */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-accent-gold text-white w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-lg">2</div>
                            <h2 className="text-2xl font-bold font-headline uppercase tracking-wider">Payment Method</h2>
                        </div>
                        <PaymentGateway
                            onMethodChange={(m) => setPaymentMethod(m)}
                            currentMethod={paymentMethod}
                        />

                        {paymentMethod === 'card' && (
                            <div className="p-8 lg:p-12 bg-white rounded-[3rem] shadow-sm border border-accent-gold/5 space-y-8 mt-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 bg-accent-gold/10 text-accent-gold rounded-full flex items-center justify-center shrink-0">
                                        <CreditCard className="w-10 h-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-bold">Secure Stripe Gateway</h3>
                                        <p className="text-muted-foreground leading-relaxed">
                                            We use Stripe for secure, industry-leading payments. Supports Card, UPI, GPay, Apple Pay and more.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handlePlaceOrder}
                                    disabled={isProcessing}
                                    className="w-full h-20 rounded-3xl bg-neutral-900 text-white hover:bg-black font-bold text-xl shadow-2xl hover:scale-[1.02] transition-all active:scale-95 border-none"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="mr-3 w-6 h-6 animate-spin" />
                                            Initializing...
                                        </>
                                    ) : (
                                        <>
                                            Proceed to Secure Payment
                                            <ArrowRight className="ml-3 w-6 h-6 text-accent-gold" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {paymentMethod === 'cash' && (
                            <div className="p-8 lg:p-12 bg-neutral-50 rounded-[3rem] text-center space-y-6 border border-dashed border-neutral-200 mt-8">
                                <div className="w-20 h-20 bg-accent-gold/10 text-accent-gold rounded-full flex items-center justify-center mx-auto">
                                    <Banknote className="w-10 h-10" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold">Pay on Delivery</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Confirm your address above and place order. Pay with cash when your authentic feast arrives.
                                    </p>
                                </div>
                                <Button
                                    onClick={handlePlaceOrder}
                                    disabled={isProcessing}
                                    className="h-20 px-12 rounded-3xl bg-neutral-900 text-white hover:bg-black font-bold text-xl shadow-lg border-none"
                                >
                                    Confirm Cash Order
                                </Button>
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar Summary */}
                <div className="w-full lg:w-[400px]">
                    <div className="sticky top-32 space-y-6">
                        <Card className="rounded-[3rem] shadow-2xl border-none overflow-hidden bg-neutral-900 text-white">
                            <CardHeader className="bg-white/5 p-8 border-b border-white/10">
                                <CardTitle className="text-xl font-bold font-headline tracking-wider uppercase">Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="space-y-6 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                    {items.map(item => (
                                        <div key={item.id} className="group">
                                            <div className="flex justify-between items-start gap-4 mb-1">
                                                <p className="font-bold flex-1 text-sm">{item.quantity}x {item.product.name}</p>
                                                <span className="font-bold text-accent-gold">{formatPrice(item.product.list_price * item.quantity)}</span>
                                            </div>
                                            {item.notes && <p className="text-[10px] text-white/40 italic">"{item.notes}"</p>}
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-6 border-t border-white/10 space-y-4">
                                    <div className="flex justify-between text-2xl font-bold pt-4 text-accent-gold font-headline">
                                        <span>Total</span>
                                        <span>{formatPrice(total)}</span>
                                    </div>
                                    <p className="text-[10px] text-white/30 text-center">Tax included in prices</p>
                                </div>

                                <div className="flex items-center justify-center gap-6 text-[10px] text-white/20 pt-4">
                                    <div className="flex items-center gap-1">
                                        <Truck className="w-3 h-3 text-accent-gold" />
                                        Express Delivery
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3 text-accent-gold" />
                                        Stripe Secure
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-6 rounded-[2rem] bg-accent-gold/5 border border-accent-gold/10 flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-accent-gold shrink-0 mt-1" />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Secure end-to-end encrypted checkout. Your culinary journey with RAM & CO is protected by production-grade security.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
