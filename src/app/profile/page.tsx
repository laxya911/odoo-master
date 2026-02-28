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
import { Package, MapPin, Clock, ChevronRight, User, LogOut, Edit3, Save, X, Camera, RefreshCw, Mail, Phone, ShieldCheck, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Partner, PosOrder } from '@/lib/types';
import Image from 'next/image';

export default function ProfilePage() {
    const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { formatPrice } = useCompany();
    const [userDetails, setUserDetails] = useState<Partner | null>(null);
    const [orders, setOrders] = useState<PosOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        street: '',
        city: '',
        zip: '',
        country_string: '',
        image_1920: ''
    });

    // Initial state to track changes
    const [initialFormData, setInitialFormData] = useState<typeof formData | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth');
        }
    }, [user, authLoading, router]);

    const fetchOrders = useCallback(async () => {
        if (!user || (!user.email && !user.id)) return;
        setIsHistoryLoading(true);
        try {
            const query = user.email ? `email=${user.email}` : `id=${user.id}`;
            const res = await fetch(`/api/odoo/restaurant/orders/history?${query}`);
            const data = await res.json();
            setOrders(Array.isArray(data.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setIsHistoryLoading(false);
        }

    }, [user]);

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
                country_string: Array.isArray(partner.country_id) ? partner.country_id[1] : '',
                image_1920: partner.image_1920 ? `data:image/png;base64,${partner.image_1920}` : ''
            };
            setFormData(initial);
            setInitialFormData(initial);

            // Fetch orders separately
            fetchOrders();
        } catch (error) {
            console.error('Failed to fetch profile details:', error);
            toast.error('Failed to load profile details');
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
                toast.error('Image size must be less than 2MB');
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

            toast.success('Profile updated successfully');
            setIsEditing(false);
            await refreshUser(); // Update global auth context if name changed
            fetchData(); // Refresh page data
        } catch (error) {
            toast.error('Error updating profile');
        } finally {
            setIsSaving(false);
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
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-accent-gold rounded-[3rem] blur-3xl opacity-10 -z-10 animate-pulse" />
                    <Card className="rounded-[3rem] border-none shadow-2xl shadow-neutral-200/50 overflow-hidden bg-white">
                        <div className="bg-accent-gold h-32 relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-accent-gold to-accent-gold/90" />
                        </div>
                        <CardContent className="p-8 -mt-16 flex flex-col md:flex-row items-center md:items-end gap-8">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-[2.5rem] bg-white p-2 shadow-xl overflow-hidden">
                                    <div className="w-full h-full rounded-[2rem] bg-neutral-100 flex items-center justify-center text-accent-gold overflow-hidden">
                                        {formData.image_1920 ? (
                                            <Image src={formData.image_1920} width={1920} height={1920} alt="Profile" className="w-full h-full object-cover" />
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

                            <div className="flex-grow text-center md:text-left space-y-2">
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
                                        Portal Member
                                    </Badge>
                                </div>
                                <p className="text-neutral-500 font-medium flex items-center justify-center md:justify-start gap-2">
                                    <Mail className="w-4 h-4" /> {user.email}
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
                                            <X className="w-4 h-4 mr-2" /> Cancel
                                        </Button>
                                        <Button className="rounded-2xl h-12 bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold" onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="outline" className="rounded-2xl h-12 bg-accent-chili border-neutral-200 hover:bg-red-50 hover:text-accent-chili hover:border-accent-chili/20" onClick={handleLogout}>
                                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                                        </Button>
                                        <Button className="rounded-2xl h-12 bg-accent-gold hover:bg-accent-gold/90 shadow-lg shadow-accent-gold/20" onClick={() => setIsEditing(true)}>
                                            <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
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
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6 px-2">Account Info</CardTitle>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 p-4 rounded-3xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="p-3 rounded-2xl bg-white shadow-sm text-accent-gold">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Total Spent</p>
                                        <p className="text-sm font-bold text-neutral-900">{isHistoryLoading ? '...' : formatPrice(totalSpent)}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 p-4 rounded-3xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-white shadow-sm text-accent-gold">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Status</p>
                                            <p className="text-sm font-bold text-neutral-900">Verified Member</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 p-4 rounded-3xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-white shadow-sm text-accent-gold">
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Phone</p>
                                            {isEditing ? (
                                                <div className="space-y-1 mt-1">
                                                    <Label className="text-[10px] text-neutral-400">CONTACT NUMBER</Label>
                                                    <Input
                                                        value={formData.phone}
                                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                                        className="h-8 rounded-lg border-neutral-200 text-sm focus:border-accent-gold focus:ring-accent-gold/20"
                                                        placeholder="Phone number"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-sm font-bold text-neutral-900">{userDetails?.phone || 'Not provided'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 p-4 rounded-3xl bg-neutral-50 border border-neutral-100/50">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-2xl bg-white shadow-sm text-accent-gold">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Address Details</p>
                                            {isEditing ? (
                                                <div className="space-y-3 mt-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase font-bold text-neutral-400">Street</Label>
                                                        <Input
                                                            value={formData.street}
                                                            onChange={e => setFormData(p => ({ ...p, street: e.target.value }))}
                                                            placeholder="Street"
                                                            className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">City</Label>
                                                            <Input
                                                                value={formData.city}
                                                                onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                                                                placeholder="City"
                                                                className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase font-bold text-neutral-400">ZIP</Label>
                                                            <Input
                                                                value={formData.zip}
                                                                onChange={e => setFormData(p => ({ ...p, zip: e.target.value }))}
                                                                placeholder="ZIP"
                                                                className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase font-bold text-neutral-400">Country</Label>
                                                        <Input
                                                            value={formData.country_string}
                                                            onChange={e => setFormData(p => ({ ...p, country_string: e.target.value }))}
                                                            placeholder="Country"
                                                            className="h-8 rounded-lg text-xs border-neutral-200 focus:border-accent-gold"
                                                            disabled
                                                        />
                                                        <p className="text-[8px] text-neutral-400 italic">Country managed by Odoo</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-bold text-neutral-900 leading-relaxed">
                                                        {userDetails?.street || 'No address saved'}
                                                    </p>
                                                    {(userDetails?.city || userDetails?.zip) && (
                                                        <p className="text-xs font-medium text-neutral-500">
                                                            {userDetails.city}{userDetails.city && userDetails.zip ? ', ' : ''}{userDetails.zip}
                                                        </p>
                                                    )}
                                                    {Array.isArray(userDetails?.country_id) && (
                                                        <p className="text-xs font-medium text-neutral-400">{userDetails.country_id[1]}</p>
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
                        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-100 bg-white p-8">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-2xl font-bold font-headline text-neutral-900">Order History</h3>
                                    <p className="text-sm text-neutral-500 font-medium">Your culinary journey with RAM & CO.</p>
                                </div>
                                <Button variant="ghost" className="rounded-xl text-accent-gold font-bold hover:bg-accent-gold/5" onClick={fetchOrders}>
                                    Refresh
                                </Button>
                            </div>

                            <div className="space-y-6">
                                {isHistoryLoading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                                    </div>
                                ) : orders.length > 0 ? (
                                    <div className="space-y-4">
                                        {orders.map((order: PosOrder) => (
                                            <div key={order.id} className="group flex items-center justify-between p-5 rounded-[2rem] bg-neutral-50 border border-neutral-100 hover:border-accent-gold/20 hover:bg-white hover:shadow-lg transition-all duration-300">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-accent-gold font-bold text-sm">
                                                        <Package size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-neutral-900">{order.pos_reference || order.name}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-xs text-neutral-400 flex items-center gap-1">
                                                                <Clock size={12} /> {new Date(order.date_order).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            <Badge className={`text-[10px] uppercase font-bold border-none px-3 py-0.5 rounded-full ${order.state === 'paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                                                }`}>
                                                                {order.state}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-neutral-900">{formatPrice(order.amount_total)}</p>
                                                    <Link
                                                        href={`/track/${order.pos_reference || order.id}`}
                                                        className="text-xs font-bold text-accent-gold mt-2 flex items-center gap-1 ml-auto opacity-70 group-hover:opacity-100 transition-opacity hover:underline"
                                                    >
                                                        Details <ChevronRight size={14} />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 rounded-[2rem] bg-neutral-50 border-2 border-dashed border-neutral-100">
                                        <div className="p-4 rounded-full bg-white shadow-sm text-neutral-300">
                                            <Clock size={32} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-lg font-bold text-neutral-900">No recent orders</p>
                                            <p className="text-sm text-neutral-500 max-w-[240px]">Explore our menu and place your first order today.</p>
                                        </div>
                                        <Button className="mt-4 rounded-2xl bg-accent-gold hover:bg-accent-gold/90 shadow-lg shadow-accent-gold/20" onClick={() => router.push('/menu')}>
                                            Order Now
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
