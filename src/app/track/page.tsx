
"use client"

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Package, Utensils, Bike, CheckCircle, Clock, ChefHat, MapPin, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { OrderStatus, formatPrice } from '@/lib/odoo-mock';
import { useCart } from '@/context/CartContext';
import { ProductAttribute } from '@/lib/types';
import Link from 'next/link';

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
    { status: 'received', label: 'Received', icon: Package },
    { status: 'preparing', label: 'Kitchen', icon: ChefHat },
    { status: 'ready', label: 'Packing', icon: Utensils },
    { status: 'delivering', label: 'Out', icon: Bike },
    { status: 'delivered', label: 'Arrived', icon: CheckCircle },
];

export default function TrackOrderPage() {
    const { lastOrder } = useCart();
    const [currentStatus, setCurrentStatus] = useState<OrderStatus>('received');
    const [progress, setProgress] = useState(15);

    useEffect(() => {
        if (!lastOrder) return;

        const sequence: OrderStatus[] = ['received', 'preparing', 'ready', 'delivering', 'delivered'];
        let idx = 0;

        const interval = setInterval(() => {
            idx++;
            if (idx < sequence.length) {
                setCurrentStatus(sequence[idx]);
                setProgress(20 + idx * 20);
            } else {
                clearInterval(interval);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [lastOrder]);

    if (!lastOrder) {
        return (
            <div className="container mx-auto px-4 py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-12 h-12 text-accent-gold" />
                </div>
                <h1 className="text-3xl font-bold font-headline">No Active Orders</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">Place an order to see real-time tracking from the RAM kitchen to your door.</p>
                <Link href="/menu">
                    <Button className="rounded-full px-8 h-12 bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground">Browse Our Menu</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <div className="text-center mb-16 space-y-2">
                <h1 className="text-5xl font-bold font-headline">Live <span className="text-accent-gold">Tracking</span></h1>
                <p className="text-muted-foreground font-bold tracking-widest text-sm">ORDER ID: #{lastOrder.id}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
                        <CardHeader className="bg-accent-gold text-white p-10">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-3xl font-headline">Estimated Delivery</CardTitle>
                                    <CardDescription className="text-white/80 text-lg">Your feast is about 20-25 mins away</CardDescription>
                                </div>
                                <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                                    <Clock className="w-10 h-10" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 space-y-12">
                            <div className="relative pt-10 pb-6">
                                <Progress value={progress} className="h-4 bg-muted [&>div]:bg-accent-gold" />
                                <div className="flex justify-between mt-8">
                                    {STATUS_STEPS.map((step, idx) => {
                                        const Icon = step.icon;
                                        const stepIdx = STATUS_STEPS.findIndex(s => s.status === currentStatus);
                                        const isActive = stepIdx >= idx;
                                        const isCurrent = step.status === currentStatus;

                                        return (
                                            <div key={step.status} className="flex flex-col items-center gap-3">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-lg
                          ${isActive ? 'bg-accent-gold text-white scale-110 shadow-accent-gold/30' : 'bg-muted text-muted-foreground'}
                          ${isCurrent ? 'ring-4 ring-accent-gold/20 animate-pulse' : ''}`}>
                                                    <Icon className="w-7 h-7" />
                                                </div>
                                                <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest text-center max-w-[80px]
                          ${isActive ? 'text-accent-gold' : 'text-muted-foreground'}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-10 border-t border-dashed space-y-6">
                                <div className="flex items-start gap-5">
                                    <div className="p-3 bg-accent-gold/10 rounded-2xl">
                                        <MapPin className="text-accent-gold w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-lg font-headline">Delivery Destination</p>
                                        <p className="text-muted-foreground">Mito Minami District, Street 3-3-16</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white">
                        <CardContent className="p-10">
                            <div className="flex items-center gap-8">
                                <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-accent-gold/5">
                                    <Image src="https://picsum.photos/seed/chef-arjun/300/300" alt="Executive Chef" fill className="object-cover" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <p className="text-xs font-bold text-accent-gold uppercase tracking-widest">Mastering the Tandoor</p>
                                    <h3 className="text-2xl font-bold font-headline">Chef Arjun Ram</h3>
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle className="w-5 h-5 fill-current" />
                                        <span className="text-sm font-bold text-foreground">Odoo Verified Partner</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="rounded-full px-8 h-12 border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-white font-bold transition-all">Support Chat</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="rounded-[2.5rem] border-none shadow-2xl sticky top-24 bg-[#FAF4F0]">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="font-headline text-2xl">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-4">
                                {lastOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-sm gap-4">
                                        <div className="flex-1">
                                            <p className="font-bold">{item.quantity}x {item.product.name}</p>
                                            {item.selectedAttributes && Object.entries(item.selectedAttributes).map(([attrId, valId]) => {
                                                const attr = item.product.attributes?.find((a: ProductAttribute) => String(a.id) === String(attrId));
                                                // Handle both single value and array of values
                                                const valueIds = Array.isArray(valId) ? valId : [valId];
                                                return valueIds.map((vid: number) => {
                                                    const val = attr?.values.find((v: { id: number; name: string }) => String(v.id) === String(vid));
                                                    return val ? <p key={`${attrId}-${vid}`} className="text-[10px] text-muted-foreground uppercase">{val.name}</p> : null;
                                                });
                                            })}
                                            {/* Fallback for Odoo-style meta attributes */}
                                            {!item.selectedAttributes && item.meta?.attribute_value_ids?.map((vid: number) => {
                                                // Try to find the value name in ANY attribute of the product
                                                let foundValName = "";
                                                item.product.attributes?.forEach((attr: ProductAttribute) => {
                                                    const val = attr.values.find((v: { id: number; name: string }) => String(v.id) === String(vid));
                                                    if (val) foundValName = val.name;
                                                });
                                                return foundValName ? <p key={vid} className="text-[10px] text-muted-foreground uppercase">{foundValName}</p> : null;
                                            })}
                                        </div>
                                        <span className="font-bold text-accent-gold">{formatPrice((item.product.list_price || item.product.price || 0) * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-accent-gold/10 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-bold">{formatPrice(lastOrder.subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Tax (10%)</span>
                                    <span className="font-bold">{formatPrice(lastOrder.tax)}</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl font-bold pt-4 text-accent-gold font-headline">
                                    <span>Total Paid</span>
                                    <span>{formatPrice(lastOrder.total)}</span>
                                </div>
                            </div>

                            <div className="pt-6">
                                <div className="bg-white p-6 rounded-3xl flex items-center gap-4 shadow-sm">
                                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest">Payment Success</p>
                                        <p className="text-[10px] text-muted-foreground">Stripe Transaction: {lastOrder.id}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
