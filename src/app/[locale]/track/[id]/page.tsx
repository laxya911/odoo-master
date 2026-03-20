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
import { generateInvoice } from '@/lib/pdf-invoice';
import { useTranslations } from 'next-intl';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';
import { useCart } from '@/context/CartContext';

type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

const STATUS_STEPS: { status: OrderStatus; key: string; icon: React.ElementType }[] = [
    { status: 'received', key: 'received', icon: Package },
    { status: 'preparing', key: 'preparing', icon: ChefHat },
    { status: 'ready', key: 'ready', icon: Utensils },
    { status: 'delivering', key: 'delivering', icon: Bike },
    { status: 'delivered', key: 'delivered', icon: CheckCircle },
];

export default function DynamicTrackOrderPage() {
    const params = useParams();
    const router = useRouter();
    const { formatPrice } = useCompany();
    const t = useTranslations('track');
    const { translate } = useDynamicTranslation();
    const [order, setOrder] = useState<any>(null); // Keeping any for now due to large Odoo object, but will add specific interface if needed
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track status simulation (until backend logic is ready)
    const [currentStatus, setCurrentStatus] = useState<OrderStatus>('received');
    const [progress, setProgress] = useState(15);
    const { clearCart } = useCart();

    useEffect(() => {
        // Clear cart if arriving from a successful payment
        if (typeof window !== 'undefined' && window.location.search.includes('success=true')) {
            clearCart();
        }

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
            <div className="container mx-auto px-4 py-32 max-w-6xl animate-pulse space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <div className="h-4 w-24 bg-neutral-200 rounded-full" />
                        <div className="h-12 w-64 bg-neutral-200 rounded-2xl" />
                        <div className="h-6 w-48 bg-neutral-200 rounded-full" />
                    </div>
                    <div className="h-20 w-48 bg-neutral-200 rounded-[2rem]" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 h-[400px] bg-neutral-200 rounded-[3rem]" />
                    <div className="h-[400px] bg-neutral-200 rounded-[2.5rem]" />
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
                <h1 className="text-3xl font-bold font-headline">{t('orderNotFound')}</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">{error || t('orderNotFoundDesc')}</p>
                <Button variant="outline" className="rounded-full px-8 h-12" onClick={() => router.back()}>
                    {t('goBack')}
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-32 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="space-y-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-neutral-400 hover:text-accent-gold transition-colors font-bold text-xs uppercase tracking-widest"
                    >
                        <ChevronLeft size={16} /> {t('backHistory')}
                    </button>
                    <h1 className="text-5xl font-bold font-headline">
                        {t('orderStatus').includes(' ') ? (
                            <>
                                {t('orderStatus').split(' ')[0]} <span className="text-accent-gold">{t('orderStatus').split(' ')[1]}</span>
                            </>
                        ) : (
                            t('orderStatus')
                        )}
                    </h1>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-neutral-100 text-neutral-600 border-none px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                            {t('receipt')}: {order.pos_reference || order.name || order.id}
                        </Badge>
                        <span className="text-xs text-neutral-400 font-medium">{t('placedOn')} {new Date(order.date_order).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="bg-green-50 text-green-700 px-6 py-4 rounded-[2rem] border border-green-100 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                        <Receipt size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1">{t('payment')}</p>
                        <p className="text-sm font-bold leading-none">{t('paidOnline')}</p>
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
                                    <CardTitle className="text-3xl font-headline text-white">{t('realTimeCheck')}</CardTitle>
                                    <CardDescription className="text-white/70 text-lg">{t('currently', { status: t(currentStatus) })}</CardDescription>
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
                                                    {t(step.key)}
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
                                    <p className="font-bold text-lg font-headline text-neutral-900">{t('deliveryAddress')}</p>
                                    <div className="text-neutral-600 font-medium space-y-0.5">
                                        <p className="text-neutral-900 font-bold">{order.partner_detail?.name || order.partner_id?.[1] || t('noName')}</p>
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
                        <div className="p-8 bg-neutral-50 border-b flex justify-between items-center">
                            <h3 className="font-headline text-primary text-2xl flex items-center gap-3">
                                <Receipt className="text-accent-gold" /> <span className="text-neutral-900 font-bold">{t('itemsSummary')}</span>
                            </h3>
                            {order && ['paid', 'done', 'invoiced'].includes(order.state) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full border-neutral-200 text-neutral-600 hover:text-accent-gold hover:border-accent-gold/20"
                                    onClick={() => generateInvoice({ order })}
                                >
                                    {t('downloadInvoice')}
                                </Button>
                            )}
                        </div>
                        <ScrollArea className="h-[40vh] min-h-[300px] w-full">
                            <CardContent className="p-8 pb-4">
                                <div className="space-y-5">
                                    {order.line_items?.map((item: { qty: number; full_product_name?: string; product_id?: [number, string]; note?: string; customer_note?: string; price_subtotal_incl: number; combo_parent_id?: [number, string] }, idx: number) => {
                                        const isChild = !!item.combo_parent_id;
                                        return (
                                            <div key={idx} className={`flex justify-between items-start gap-4 ${isChild ? 'ml-6 border-l-2 border-neutral-100 pl-4 py-1' : ''}`}>
                                                <div className="space-y-1 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${isChild ? 'bg-neutral-100 text-neutral-500' : 'bg-accent-gold text-primary'}`}>
                                                            {item.qty}×
                                                        </span>
                                                        <p className={`text-sm font-bold leading-tight ${isChild ? 'text-neutral-600' : 'text-neutral-900'}`}>
                                                            {item.full_product_name ? translate(item.full_product_name) : (item.product_id ? translate(item.product_id[1]) : t('unknownProduct'))}
                                                        </p>
                                                    </div>
                                                    {(item.customer_note || item.note) && (() => {
                                                        // Prefer customer_note (plain text). Fall back to parsing note (JSON format).
                                                        let noteText = '';
                                                        if (item.customer_note) {
                                                            noteText = item.customer_note.replace(/^Note:\s*/i, '');
                                                        } else if (item.note) {
                                                            try {
                                                                const parsed = JSON.parse(item.note);
                                                                if (Array.isArray(parsed)) {
                                                                    noteText = parsed.map((n: any) => n.note || '').filter(Boolean).join(', ');
                                                                } else {
                                                                    noteText = item.note;
                                                                }
                                                            } catch {
                                                                // Not JSON — strip "Note: " prefix if present
                                                                noteText = item.note.replace(/^Note:\s*/i, '');
                                                            }
                                                        }
                                                        return noteText ? (
                                                            <p className="text-[10px] text-neutral-500 uppercase tracking-tighter ml-7 mt-1 leading-relaxed whitespace-pre-line font-medium italic">
                                                                {t('note')}: {noteText}
                                                            </p>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                <span className={`text-sm font-bold pr-2 ${isChild ? 'text-neutral-500' : 'text-neutral-900'}`}>
                                                    {formatPrice(item.price_subtotal_incl)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </ScrollArea>
                        <div className="p-8 pt-0 mt-4 space-y-4">
                            <Separator className="bg-neutral-100" />
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-neutral-500 font-bold">{t('netAmount')}</span>
                                    <span className="text-neutral-900 font-bold">{formatPrice(order.amount_total - order.amount_tax)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-neutral-500 font-medium">{t('totalTax')}</span>
                                    <span className="text-neutral-900 font-medium">{formatPrice(order.amount_tax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-6 border-t border-dashed border-neutral-200">
                                    <span className="text-xl font-headline font-bold text-neutral-900">{t('totalPaid')}</span>
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
