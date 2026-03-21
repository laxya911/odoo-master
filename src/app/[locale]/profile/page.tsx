"use client"

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/context/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Package, MapPin, Clock, ChevronRight, User, LogOut, Edit3, Save, X, Camera, RefreshCw, Mail, Phone, ShieldCheck, Loader2, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateInvoice } from '@/lib/pdf-invoice';
import { toast } from 'sonner';
import type { Partner, PosOrder } from '@/lib/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function ProfilePage() {
    const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { formatPrice } = useCompany();
    const t = useTranslations('profile');
    const [userDetails, setUserDetails] = useState<Partner | null>(null);
    const [orders, setOrders] = useState<PosOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [page, setPage] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const limit = 10;

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        street: '',
        city: '',
        zip: '',
        country_id: '' as string | number,
        state_id: '' as string | number,
        image_1920: ''
    });

    const [countries, setCountries] = useState<Array<{ id: number; name: string }>>([]);
    const [states, setStates] = useState<Array<{ id: number; name: string; code: string }>>([]);

    // Initial state to track changes
    const [initialFormData, setInitialFormData] = useState<typeof formData | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch countries
    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const res = await fetch('/api/odoo/countries');
                const data = await res.json();
                setCountries(data.countries || []);
            } catch (error) {
                console.error('Failed to fetch countries:', error);
            }
        };
        fetchCountries();
    }, []);

    // Fetch states when country changes
    useEffect(() => {
        const fetchStates = async () => {
            if (!formData.country_id) {
                setStates([]);
                return;
            }
            try {
                const res = await fetch(`/api/odoo/states?country_id=${formData.country_id}`);
                const data = await res.json();
                setStates(data.states || []);
            } catch (error) {
                console.error('Failed to fetch states:', error);
            }
        };
        fetchStates();
    }, [formData.country_id]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth');
        }
    }, [user, authLoading, router]);

    const fetchOrders = useCallback(async (currentPage = 0) => {
        if (!user || (!user.email && !user.id)) return;
        setIsHistoryLoading(true);
        try {
            const query = user.email ? `email=${user.email}` : `id=${user.id}`;
            const offset = currentPage * limit;
            const res = await fetch(`/api/odoo/restaurant/orders/history?${query}&limit=${limit}&offset=${offset}`);
            const data = await res.json();
            setOrders(Array.isArray(data.data) ? data.data : []);
            setTotalOrders(data.meta?.total || 0);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setIsHistoryLoading(false);
        }

    }, [user, limit]);

    // Compute total spent from paid/done orders
    const totalSpent = useMemo(() => {
        return orders
            .filter(o => o.state === 'paid' || o.state === 'done' || o.state === 'invoiced')
            .reduce((sum, o) => sum + (o.amount_total || 0), 0);
    }, [orders]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/odoo/restaurant/profile?id=${user.id}`);
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            const data = await res.json();
            // API returns { partner, recentOrders } - extract partner
            const partner = data.partner || data;
            setUserDetails(partner);
            const initial = {
                name: partner.name || user.name || '',
                phone: partner.phone || '',
                street: partner.street || '',
                city: partner.city || '',
                zip: partner.zip || '',
                country_id: Array.isArray(partner.country_id) ? partner.country_id[0] : '',
                state_id: Array.isArray(partner.state_id) ? partner.state_id[0] : '',
                image_1920: partner.image_1920 ? `data:image/png;base64,${partner.image_1920}` : ''
            };
            setFormData(initial);
            setInitialFormData(initial);

            // Fetch orders separately
            fetchOrders(0);
            setPage(0);
        } catch (error) {
            console.error('Failed to fetch profile details:', error);
            toast.error(t('loadProfileError'));
        } finally {
            setIsLoading(false);
        }
    }, [user, fetchOrders]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push('/auth');
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error(t('imageSizeError'));
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image_1920: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Find only changed fields
            const changedFields: Record<string, any> = {};

            if (formData.name !== initialFormData?.name) changedFields.name = formData.name;
            if (formData.phone !== initialFormData?.phone) changedFields.phone = formData.phone;
            if (formData.street !== initialFormData?.street) changedFields.street = formData.street;
            if (formData.city !== initialFormData?.city) changedFields.city = formData.city;
            if (formData.zip !== initialFormData?.zip) changedFields.zip = formData.zip;
            if (formData.country_id !== initialFormData?.country_id) changedFields.country_id = formData.country_id;
            if (formData.state_id !== initialFormData?.state_id) changedFields.state_id = formData.state_id;

            // Handle image specifically: strip 'data:image/...;base64,' prefix
            if (formData.image_1920 !== initialFormData?.image_1920) {
                const base64Content = formData.image_1920.includes('base64,')
                    ? formData.image_1920.split('base64,')[1]
                    : formData.image_1920;
                changedFields.image_1920 = base64Content;
            }

            if (Object.keys(changedFields).length === 0) {
                setIsEditing(false);
                setIsSaving(false);
                return;
            }

            const res = await fetch('/api/odoo/restaurant/profile/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...changedFields, email: user?.email })
            });

            if (!res.ok) throw new Error('Failed to update profile');

            toast.success(t('updateSuccess'));
            setIsEditing(false);
            await refreshUser(); // Update global auth context if name changed
            fetchData(); // Refresh page data
        } catch (error) {
            toast.error(t('updateError'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadInvoice = async (orderId: string | number, posReference: string | undefined) => {
        const toastId = toast.loading(t('preparingInvoice', { ref: posReference || '' }));
        try {
            const res = await fetch(`/api/odoo/restaurant/orders/${orderId}`);
            if (!res.ok) throw new Error('Failed to fetch order details');
            const data = await res.json();
            if (data.order) {
                generateInvoice(data);
                toast.success(t('invoiceDownloaded'), { id: toastId });
            } else {
                throw new Error('Invalid order data');
            }
        } catch (error) {
            console.error('Error generating invoice:', error);
            toast.error(t('invoiceError'), { id: toastId });
        }
    };

    if (authLoading || (isLoading && !userDetails)) {
        return (
            <div className="container mx-auto px-4 py-32 max-w-4xl space-y-8">
                <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Skeleton className="h-64 rounded-[2.5rem]" />
                    <Skeleton className="h-64 md:col-span-2 rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen  pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-5xl">
                {/* Header Profile Card */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-accent-gold rounded-[2.5rem] blur-3xl opacity-5 -z-10 animate-pulse" />
                    <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-100/50 overflow-hidden bg-white">
                        <div className="bg-accent-gold h-24 relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-accent-gold to-accent-gold/90" />
                        </div>
                        <CardContent className="p-6 -mt-12 flex flex-col md:flex-row items-center md:items-end gap-6">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-[2.5rem] bg-white p-2 shadow-xl overflow-hidden">
                                    <div className="w-full h-full rounded-[2rem] bg-neutral-100 flex items-center justify-center text-accent-gold overflow-hidden">
                                        {formData.image_1920 ? (
                                            <Image src={formData.image_1920} width={1920} height={1920} alt="Profile" className="w-full h-full object-cover" />
                                        ) : user?.image ? (
                                            <img
                                                src={user.image}
                                                alt={user.name}
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : user?.image_1920 ? (
                                            <Image src={`data:image/png;base64,${user.image_1920}`} width={1920} height={1920} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={48} />
                                        )}
                                    </div>
                                </div>
                                {isEditing && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center rounded-[2.5rem] bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <Camera className="w-8 h-8" />
                                    </button>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white w-8 h-8 rounded-full" />
                            </div>

                            <div className="flex-grow text-center md:text-left space-y-1">
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    {isEditing ? (
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                            className="text-3xl font-bold h-12 w-auto max-w-sm rounded-xl border-accent-gold"
                                        />
                                    ) : (
                                        <h1 className="text-3xl font-bold font-headline text-neutral-900">{userDetails?.name || user.name}</h1>
                                    )}
                                    <Badge variant="secondary" className="bg-accent-gold/10 text-accent-gold border-none px-4 py-1 rounded-full uppercase text-[10px] tracking-widest font-bold">
                                        {t('memberStatus')}
                                    </Badge>
                                </div>
                                <p className="text-neutral-500 font-medium flex items-center justify-center md:justify-start gap-2 text-sm">
                                    <Mail className="w-3.5 h-3.5" /> {user.email}
                                </p>
                            </div>

                            <div className="flex gap-4">
                                {isEditing ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="rounded-2xl h-12 border-neutral-200 text-neutral-600 hover:text-neutral-900"
                                            onClick={() => setIsEditing(false)}
                                        >
                                            <X className="w-4 h-4 mr-2" /> {t('cancel')}
                                        </Button>
                                        <Button className="rounded-2xl h-12 bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold" onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {t('saveChanges')}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="outline" className="rounded-2xl h-12 bg-accent-chili border-neutral-200 hover:bg-red-50 hover:text-accent-chili hover:border-accent-chili/20" onClick={handleLogout}>
                                            <LogOut className="w-4 h-4 mr-2" /> {t('signOut')}
                                        </Button>
                                        <Button className="rounded-2xl h-12 bg-accent-gold hover:bg-accent-gold/90 shadow-lg shadow-accent-gold/20" onClick={() => setIsEditing(true)}>
                                            <Edit3 className="w-4 h-4 mr-2" /> {t('editProfile')}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Left Column: Stats & Info */}
                    <div className="md:col-span-4 space-y-8">
                        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-100 bg-white p-6">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4 px-1">{t('accountInfo')}</CardTitle>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50 border border-neutral-100/50">
                                        <div className="p-2 rounded-xl bg-white shadow-sm text-accent-gold">
                                            <RefreshCw className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-400 leading-tight">{t('totalSpent')}</p>
                                            <p className="text-xs font-bold text-neutral-900">{isHistoryLoading ? '...' : formatPrice(totalSpent)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50 border border-neutral-100/50">
                                        <div className="p-2 rounded-xl bg-white shadow-sm text-accent-gold">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-400 leading-tight">{t('status')}</p>
                                            <p className="text-xs font-bold text-neutral-900">{t('verified')}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-white shadow-sm text-accent-gold">
                                            <Phone className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-400 leading-tight">{t('phone')}</p>
                                            {isEditing ? (
                                                <div className="space-y-1 mt-1">
                                                    <Input
                                                        value={formData.phone}
                                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                                        className="h-7 rounded-lg border-neutral-200 text-[11px] focus:border-accent-gold focus:ring-accent-gold/20"
                                                        placeholder={t('phone')}
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-neutral-900">{userDetails?.phone || 'Not provided'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-white shadow-sm text-accent-gold">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-400 leading-tight">{t('address')}</p>
                                            {isEditing ? (
                                                <div className="space-y-3 mt-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase font-bold text-neutral-400">{t('street')}</Label>
                                                        <Input
                                                            value={formData.street}
                                                            onChange={e => setFormData(p => ({ ...p, street: e.target.value }))}
                                                            placeholder={t('street')}
                                                            className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">{t('city')}</Label>
                                                            <Input
                                                                value={formData.city}
                                                                onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                                                                placeholder={t('city')}
                                                                className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">{t('zip')}</Label>
                                                            <Input
                                                                value={formData.zip}
                                                                onChange={e => setFormData(p => ({ ...p, zip: e.target.value }))}
                                                                placeholder={t('zip')}
                                                                className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">{t('country')}</Label>
                                                            <Select
                                                                value={formData.country_id ? formData.country_id.toString() : ""}
                                                                onValueChange={val => setFormData(p => ({ ...p, country_id: parseInt(val, 10), state_id: '' }))}
                                                            >
                                                                <SelectTrigger className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold">
                                                                    <SelectValue placeholder={t('selectCountry')} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {countries.map(c => (
                                                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">{t('state')}</Label>
                                                            <Select
                                                                value={formData.state_id ? formData.state_id.toString() : ""}
                                                                onValueChange={val => setFormData(p => ({ ...p, state_id: parseInt(val, 10) }))}
                                                                disabled={!formData.country_id || states.length === 0}
                                                            >
                                                                <SelectTrigger className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold">
                                                                    <SelectValue placeholder={states.length === 0 && formData.country_id ? t('noStates') : t('selectState')} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {states.map(s => (
                                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5 mt-1">
                                                    <p className="text-xs font-bold text-neutral-900 leading-tight">
                                                        {userDetails?.street || t('noAddress')}
                                                    </p>
                                                    {(userDetails?.city || userDetails?.zip || Array.isArray(userDetails?.state_id)) && (
                                                        <p className="text-[10px] font-medium text-neutral-500">
                                                            {[userDetails?.city, Array.isArray(userDetails?.state_id) ? userDetails.state_id[1] : '', userDetails?.zip].filter(Boolean).join(', ')}
                                                        </p>
                                                    )}
                                                    {Array.isArray(userDetails?.country_id) && (
                                                        <p className="text-[10px] font-medium text-neutral-400 leading-none mt-1">{userDetails.country_id[1]}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Activity / History */}
                    <div className="md:col-span-8 space-y-8">
                        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-100 bg-white p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold font-headline text-neutral-900">{t('orderHistory')}</h3>
                                    <p className="text-xs text-neutral-500 font-medium">{t('culinaryJourney')}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    className="rounded-xl text-accent-gold font-bold hover:bg-accent-gold/5 h-8 text-xs"
                                    onClick={() => {
                                        fetchOrders(page);
                                    }}
                                >
                                    {t('refresh')}
                                </Button>
                            </div>

                            <div className="space-y-6">
                                {isHistoryLoading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                                    </div>
                                ) : orders.length > 0 ? (
                                    <>
                                        {/* Table Header */}
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                            <div className="col-span-5">Order Reference</div>
                                            <div className="col-span-3">Status</div>
                                            <div className="col-span-2 text-right">Amount</div>
                                            <div className="col-span-2 text-right">Actions</div>
                                        </div>

                                        {orders.map((order: PosOrder) => (
                                            <div key={order.id} className="group grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-4 rounded-[1.5rem] bg-neutral-50 border border-neutral-100 hover:border-accent-gold/20 hover:bg-white hover:shadow-md transition-all duration-300">
                                                <div className="col-span-5 flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-accent-gold font-bold transition-transform group-hover:scale-110">
                                                        <Package size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-neutral-900 truncate max-w-[150px] md:max-w-full">
                                                            {order.pos_reference || order.name}
                                                        </p>
                                                        <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                                                            <Clock size={10} /> {new Date(order.date_order).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="col-span-3 flex items-center md:justify-start">
                                                    <Badge className={`text-[9px] uppercase font-bold border-none px-2.5 py-0.5 rounded-full ${order.state === 'paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                                        }`}>
                                                        {order.state}
                                                    </Badge>
                                                </div>

                                                <div className="col-span-2 text-right">
                                                    <p className="text-sm font-bold text-neutral-900">{formatPrice(order.amount_total)}</p>
                                                </div>

                                                <div className="col-span-2 flex items-center justify-end gap-3">
                                                    {['paid', 'done', 'invoiced'].includes(order.state) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleDownloadInvoice(order.id, order.pos_reference || order.name);
                                                            }}
                                                            className="p-1.5 rounded-lg bg-white border border-neutral-100 text-neutral-400 hover:text-accent-gold hover:border-accent-gold/20 transition-all"
                                                            title="Download Receipt"
                                                        >
                                                            <Receipt size={14} />
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/track/${order.pos_reference || order.id}`}
                                                        className="p-1.5 rounded-lg bg-accent-gold/10 text-accent-gold hover:bg-accent-gold hover:text-white transition-all"
                                                        title="Order Details"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Pagination Controls */}
                                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-neutral-100">
                                            <p className="text-xs font-medium text-neutral-400">
                                                Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalOrders)} of {totalOrders} orders
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl border-neutral-200 h-8 px-4"
                                                    onClick={() => {
                                                        const newPage = Math.max(0, page - 1);
                                                        setPage(newPage);
                                                        fetchOrders(newPage);
                                                    }}
                                                    disabled={page === 0}
                                                >
                                                    Previous
                                                </Button>
                                                <div className="flex gap-1">
                                                    {[...Array(Math.ceil(totalOrders / limit))].map((_, i) => (
                                                        i < 3 || i === Math.ceil(totalOrders / limit) - 1 || (i >= page - 1 && i <= page + 1) ? (
                                                            <button
                                                                key={i}
                                                                onClick={() => {
                                                                    setPage(i);
                                                                    fetchOrders(i);
                                                                }}
                                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === i
                                                                        ? 'bg-accent-gold text-white'
                                                                        : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                                                                    }`}
                                                            >
                                                                {i + 1}
                                                            </button>
                                                        ) : i === 3 ? (
                                                            <span key={i} className="text-neutral-300">...</span>
                                                        ) : null
                                                    ))}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl border-neutral-200 h-8 px-4"
                                                    onClick={() => {
                                                        const newPage = Math.min(Math.ceil(totalOrders / limit) - 1, page + 1);
                                                        setPage(newPage);
                                                        fetchOrders(newPage);
                                                    }}
                                                    disabled={page >= Math.ceil(totalOrders / limit) - 1}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 rounded-[2rem] bg-neutral-50 border-2 border-dashed border-neutral-100">
                                        <div className="p-4 rounded-full bg-white shadow-sm text-neutral-300">
                                            <Clock size={32} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-lg font-bold text-neutral-900">{t('noOrders')}</p>
                                            <p className="text-sm text-neutral-500 max-w-[240px]">{t('noOrdersDesc')}</p>
                                        </div>
                                        <Button className="mt-4 rounded-2xl bg-accent-gold hover:bg-accent-gold/90 shadow-lg shadow-accent-gold/20" onClick={() => router.push('/menu')}>
                                            {t('orderNow')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div >
            </div >
        </div >
    );
}
