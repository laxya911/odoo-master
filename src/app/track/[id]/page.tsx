"use client"

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Package, Utensils, Bike, CheckCircle, Clock,
    ChefHat, MapPin, ChevronLeft, Receipt,
    Info, ShoppingBag, Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCompany } from '@/context/CompanyContext';

type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
    { status: 'received', label: 'Received', icon: Package },
    { status: 'preparing', label: 'Kitchen', icon: ChefHat },
    { status: 'ready', label: 'Packing', icon: Utensils },
    { status: 'delivering', label: 'Out', icon: Bike },
    { status: 'delivered', label: 'Arrived', icon: CheckCircle },
];

export default function DynamicTrackOrderPage() {
    const params = useParams();
    const router = useRouter();
    const { formatPrice } = useCompany();
    const [order, setOrder] = useState<any>(null); // Keeping any for now due to large Odoo object, but will add specific interface if needed
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track status simulation (until backend logic is ready)
    const [currentStatus, setCurrentStatus] = useState<OrderStatus>('received');
    const [progress, setProgress] = useState(15);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/odoo/restaurant/orders/${params.id}`);
                if (!res.ok) throw new Error('Order not found');
                const data = await res.json();
                setOrder(data.order);

                // For now, if order is fully paid/done in Odoo, show high progress
                if (data.order.state === 'paid' || data.order.state === 'done') {
                    setCurrentStatus('delivered');
                    setProgress(100);
                }
            } catch (err: unknown) {
                const error = err as Error;
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        if (params.id) fetchOrder();
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-neutral-400 animate-pulse">Fetching Order Details...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="container mx-auto px-4 py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <Info className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold font-headline">Order Not Found</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">{error || "We couldn't find the order you're looking for."}</p>
                <Button variant="outline" className="rounded-full px-8 h-12" onClick={() => router.back()}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-32 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="space-y-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-neutral-400 hover:text-accent-gold transition-colors font-bold text-xs uppercase tracking-widest"
                    >
                        <ChevronLeft size={16} /> Back to History
                    </button>
                    <h1 className="text-5xl font-bold font-headline">Order <span className="text-accent-gold">Status</span></h1>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-neutral-100 text-neutral-600 border-none px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                            Receipt: {order.pos_reference || order.name || order.id}
                        </Badge>
                        <span className="text-xs text-neutral-400 font-medium">Placed on {new Date(order.date_order).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="bg-green-50 text-green-700 px-6 py-4 rounded-[2rem] border border-green-100 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                        <Receipt size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1">Payment</p>
                        <p className="text-sm font-bold leading-none">Paid via Online</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Tracking Progress */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-[#1A1A1A] text-white p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5">
                                <ShoppingBag size={180} />
                            </div>
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-3xl font-headline text-white">Real-time Check</CardTitle>
                                    <CardDescription className="text-white/70 text-lg">Your order is currently {currentStatus}</CardDescription>
                                </div>
                                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                                    <Clock className="w-8 h-8 text-accent-gold" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 space-y-12">
                            <div className="relative pt-10 pb-6">
                                <Progress value={progress} className="h-3 bg-neutral-100 [&>div]:bg-accent-gold" />
                                <div className="flex justify-between mt-8 relative">
                                    {STATUS_STEPS.map((step, idx) => {
                                        const Icon = step.icon;
                                        const stepIdx = STATUS_STEPS.findIndex(s => s.status === currentStatus);
                                        const isActive = stepIdx >= idx;
                                        const isCurrent = step.status === currentStatus;

                                        return (
                                            <div key={step.status} className="flex flex-col items-center gap-3 relative z-10">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-xl
                                                    ${isActive ? 'bg-accent-gold text-primary shadow-accent-gold/20 scale-110' : 'bg-neutral-50 text-neutral-300'}
                                                    ${isCurrent ? 'ring-4 ring-accent-gold/10 animate-pulse' : ''}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest text-center max-w-[80px]
                                                    ${isActive ? 'text-accent-gold' : 'text-neutral-400'}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <Separator className="bg-neutral-100" />

                            <div className="flex items-start gap-5 p-6 bg-neutral-50 rounded-3xl border border-neutral-100 transition-all hover:shadow-md">
                                <div className="p-4 bg-accent-gold text-primary rounded-2xl shadow-lg">
                                    <MapPin size={24} />
                                </div>
                                <div className="space-y-2">
                                    <p className="font-bold text-lg font-headline text-neutral-900">Delivery Address</p>
                                    <div className="text-neutral-600 font-medium space-y-0.5">
                                        <p className="text-neutral-900 font-bold">{order.partner_detail?.name || order.partner_id?.[1] || 'No name providing'}</p>
                                        {order.partner_detail?.street && <p className="text-sm">{order.partner_detail.street}</p>}
                                        {(order.partner_detail?.city || order.partner_detail?.zip) && (
                                            <p className="text-sm">{order.partner_detail.city}{order.partner_detail.city && order.partner_detail.zip ? ', ' : ''}{order.partner_detail.zip}</p>
                                        )}
                                        {order.partner_detail?.phone && (
                                            <p className="text-xs text-neutral-400 mt-2 flex items-center gap-2">
                                                <Phone size={12} className="text-accent-gold" />
                                                <span>{order.partner_detail.phone}</span>
                                            </p>
                                        )}
                                    </div>
                                    {order.general_customer_note && (
                                        <div className="mt-3 p-3 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-400 italic">
                                            "{order.general_customer_note}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Order Summary */}
                <div className="space-y-8">
                    <Card className="rounded-[2.5rem] border-none shadow-2xl sticky top-24 bg-white overflow-hidden">
                        <div className="p-8 bg-neutral-50 border-b">
                            <h3 className="font-headline text-primary text-2xl flex items-center gap-3">
                                <Receipt className="text-accent-gold" /> <span className="text-neutral-900 font-bold">Items Summary</span>
                            </h3>
                        </div>
                        <ScrollArea className="max-h-[400px]">
                            <CardContent className="p-8 pb-4 space-y-6">
                                <div className="space-y-5">
                                    {order.line_items?.map((item: { qty: number; full_product_name?: string; product_id?: [number, string]; note?: string; price_subtotal_incl: number }, idx: number) => (
                                        <div key={idx} className="flex justify-between items-start gap-4">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-md bg-accent-gold text-primary text-[10px] font-black flex items-center justify-center">{item.qty}×</span>
                                                    <p className="text-sm font-bold text-neutral-900 leading-tight">
                                                        {item.full_product_name || (item.product_id && item.product_id[1]) || 'Unknown Product'}
                                                    </p>
                                                </div>
                                                {item.note && (
                                                    <p className="text-[10px] text-neutral-500 uppercase tracking-tighter ml-7 mt-1 leading-relaxed whitespace-pre-line font-medium italic">
                                                        Note: {item.note}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-sm font-bold text-neutral-900 pr-2">
                                                {formatPrice(item.price_subtotal_incl)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </ScrollArea>
                        <div className="p-8 pt-0 mt-4 space-y-4">
                            <Separator className="bg-neutral-100" />
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-neutral-500 font-bold">Net Amount</span>
                                    <span className="text-neutral-900 font-bold">{formatPrice(order.amount_total - order.amount_tax)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-neutral-500 font-medium">Total Tax</span>
                                    <span className="text-neutral-900 font-medium">{formatPrice(order.amount_tax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-6 border-t border-dashed border-neutral-200">
                                    <span className="text-xl font-headline font-bold text-neutral-900">Total Paid</span>
                                    <span className="text-3xl font-display font-bold text-accent-gold">{formatPrice(order.amount_total)}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
