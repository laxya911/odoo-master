"use client"

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCompany } from '@/context/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
    Package, MapPin, Clock, ChevronRight, User, LogOut, Edit3,
    Save, X, Camera, RefreshCw, Mail, Phone, ShieldCheck,
    Loader2, Receipt, Calendar, ShoppingBag, XCircle,
    CheckCircle2, Utensils, Bike, ChefHat, Info, ChevronLeft, Search
} from 'lucide-react';
import { generateInvoice } from '@/lib/pdf-invoice';
import { toast } from 'sonner';
import { odoo } from '@/lib/odoo';
import type { Partner, PosOrder } from '@/lib/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';
import { useCart } from '@/context/CartContext';

type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

const STATUS_STEPS: { status: OrderStatus; key: string; icon: React.ElementType }[] = [
    { status: 'received', key: 'received', icon: Package },
    { status: 'preparing', key: 'preparing', icon: ChefHat },
    { status: 'ready', key: 'ready', icon: Utensils },
    { status: 'delivering', key: 'delivering', icon: Bike },
    { status: 'delivered', key: 'delivered', icon: CheckCircle2 },
];

export default function DashboardPage() {
    const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { formatPrice } = useCompany();
    const { translate } = useDynamicTranslation();
    const { clearCart } = useCart();

    const t = useTranslations('dashboard');
    const tProfile = useTranslations('profile');
    const tBookings = useTranslations('myBookings');
    const tTrack = useTranslations('track');
    const tCommon = useTranslations('common');

    // Navigation State
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // Profile State
    const [userDetails, setUserDetails] = useState<Partner | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
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
    const [initialFormData, setInitialFormData] = useState<typeof formData | null>(null);
    const [countries, setCountries] = useState<Array<{ id: number; name: string }>>([]);
    const [states, setStates] = useState<Array<{ id: number; name: string; code: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Orders History State
    const [orders, setOrders] = useState<PosOrder[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [orderPage, setOrderPage] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const orderLimit = 10;

    // Bookings State
    const [activities, setActivities] = useState<{ bookings: any[], orders: any[] }>({ bookings: [], orders: [] });
    const [isLoadingActivities, setIsLoadingActivities] = useState(true);
    const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

    const [bookingFilter, setBookingFilter] = useState<'upcoming' | 'previous'>('upcoming');
    const [bookingPage, setBookingPage] = useState(0);
    const bookingsPerPage = 8;

    const filteredBookings = useMemo(() => {
        const now = new Date();
        let list = activities.bookings.filter(b => {
            const isPast = new Date(b.start_time) < now;
            return bookingFilter === 'upcoming' ? !isPast : isPast;
        });
        
        list.sort((a, b) => {
            const tA = new Date(a.start_time).getTime();
            const tB = new Date(b.start_time).getTime();
            return bookingFilter === 'upcoming' ? tA - tB : tB - tA;
        });
        return list;
    }, [activities.bookings, bookingFilter]);

    const paginatedBookings = useMemo(() => {
        return filteredBookings.slice(bookingPage * bookingsPerPage, (bookingPage + 1) * bookingsPerPage);
    }, [filteredBookings, bookingPage]);
    
    const totalBookingPages = Math.ceil(filteredBookings.length / bookingsPerPage);

    // Single Order Tracking State
    const [trackingOrder, setTrackingOrder] = useState<any>(null);
    const [isTrackingLoading, setIsTrackingLoading] = useState(false);
    const [trackingProgress, setTrackingProgress] = useState(15);
    const [trackingStatus, setTrackingStatus] = useState<OrderStatus>('received');

    // Post-payment order sync state
    const [postPaymentStatus, setPostPaymentStatus] = useState<'idle' | 'syncing' | 'found' | 'error'>('idle');

    // Handle URL params for direct tab access (run once on mount)
    const hasClearedCart = useRef(false);
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'orders', 'bookings', 'profile'].includes(tab)) {
            setActiveTab(tab);
        }
        const orderId = searchParams.get('orderId');
        if (orderId) {
            setSelectedOrderId(orderId);
            setActiveTab('orders');
        }

        if (typeof window !== 'undefined' && window.location.search.includes('success=true') && !hasClearedCart.current) {
            hasClearedCart.current = true;
            clearCart();
            setActiveTab('orders');
        }
    }, [searchParams, clearCart]);

    // Post-payment order creation: poll /api/track/latest to trigger recovery fulfillment
    const hasStartedPolling = useRef(false);
    useEffect(() => {
        if (hasStartedPolling.current) return;
        if (!user?.email) return;

        const isSuccess = typeof window !== 'undefined' && window.location.search.includes('success=true');
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (!isSuccess || !sessionId) return;

        hasStartedPolling.current = true;
        setPostPaymentStatus('syncing');
        console.log(`[dashboard] Starting post-payment polling for session: ${sessionId}`);

        let attempts = 0;
        const maxAttempts = 12;
        const createdAfter = urlParams.get('created_at') || sessionStorage.getItem('checkout_initiated_at') || '';

        const pollOrder = async () => {
            try {
                console.log(`[dashboard] Polling attempt ${attempts + 1}/${maxAttempts}...`);
                const res = await fetch(`/api/track/latest?email=${encodeURIComponent(user.email!)}&created_after=${encodeURIComponent(createdAfter)}&session_id=${sessionId}`);
                if (res.ok) {
                    const order = await res.json();
                    if (order.id) {
                        console.log(`[dashboard] Order found: ${order.id} (${order.pos_reference})`);
                        setPostPaymentStatus('found');
                        sessionStorage.removeItem('checkout_initiated_at');
                        sessionStorage.removeItem('checkout_session_id');
                        fetchActivities();
                        fetchOrders(0);
                        setTimeout(() => {
                            setSelectedOrderId(order.pos_reference || String(order.id));
                            setPostPaymentStatus('idle');
                        }, 1500);
                        return true;
                    }
                }
            } catch (err) {
                console.error('Post-payment polling error:', err);
            }
            return false;
        };

        const interval = setInterval(async () => {
            attempts++;
            const found = await pollOrder();
            if (found || attempts >= maxAttempts) {
                clearInterval(interval);
                if (!found) {
                    console.warn(`[dashboard] Order not found after ${maxAttempts} attempts`);
                    setPostPaymentStatus('error');
                    fetchActivities();
                    fetchOrders(0);
                }
            }
        }, 2500);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Data Fetching: Countries & States
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

    // Data Fetching: Orders History
    const fetchOrders = useCallback(async (currentPage = 0) => {
        if (!user || (!user.email && !user.id)) return;
        setIsHistoryLoading(true);
        try {
            const query = user.email ? `email=${user.email}` : `id=${user.id}`;
            const offset = currentPage * orderLimit;
            const res = await fetch(`/api/odoo/restaurant/orders/history?${query}&limit=${orderLimit}&offset=${offset}`);
            const data = await res.json();
            setOrders(Array.isArray(data.data) ? data.data : []);
            setTotalOrders(data.meta?.total || 0);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [user, orderLimit]);

    // Data Fetching: Bookings & Activities
    const fetchActivities = useCallback(async () => {
        if (!user?.email) return;
        setIsLoadingActivities(true);
        try {
            const res = (await odoo.getCustomerActivities(user.email)) as any;
            if (res.status === 'success') {
                setActivities({
                    bookings: res.bookings || [],
                    orders: res.orders || []
                });
            }
        } catch (error) {
            console.error('Failed to fetch activities:', error);
        } finally {
            setIsLoadingActivities(false);
        }
    }, [user?.email]);

    // Data Fetching: Profile Details
    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsLoadingProfile(true);
        try {
            const res = await fetch(`/api/odoo/restaurant/profile?id=${user.id}`);
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            const data = await res.json();
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
        } catch (error) {
            console.error('Failed to fetch profile details:', error);
            toast.error(tProfile('loadProfileError'));
        } finally {
            setIsLoadingProfile(false);
        }
    }, [user]);

    // Tracking Logic
    const fetchTrackingOrder = useCallback(async (id: string, isPoll = false) => {
        if (!id) return;
        if (!isPoll) setIsTrackingLoading(true);
        try {
            const res = await fetch(`/api/odoo/restaurant/orders/${id}`);
            if (!res.ok) throw new Error('Order not found');
            const data = await res.json();
            setTrackingOrder(data.order);

            if (data.order && data.order.delivery_status) {
                const odooStatus = data.order.delivery_status;
                const mappedStatus = odooStatus === 'on_the_way' ? 'delivering' : odooStatus;
                setTrackingStatus(mappedStatus as OrderStatus);

                const statusIndex = STATUS_STEPS.findIndex(s => s.status === mappedStatus);
                if (statusIndex !== -1) {
                    const newProgress = 15 + (statusIndex * 21.25);
                    setTrackingProgress(Math.min(Math.round(newProgress), 100));
                }
            } else if (data.order && (data.order.state === 'paid' || data.order.state === 'done')) {
                setTrackingStatus('delivered');
                setTrackingProgress(100);
            }
        } catch (err) {
            console.error('Tracking fetch error:', err);
            if (!isPoll) toast.error(tTrack('orderNotFound'));
        } finally {
            if (!isPoll) setIsTrackingLoading(false);
        }
    }, [tTrack]);

    // Polling: Track order or refresh overview activities
    const activeTabRef = useRef(activeTab);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    useEffect(() => {
        if (selectedOrderId) {
            fetchTrackingOrder(selectedOrderId);
            const interval = setInterval(() => fetchTrackingOrder(selectedOrderId, true), 10000);
            return () => clearInterval(interval);
        }
    }, [selectedOrderId, fetchTrackingOrder]);

    // Initial Load
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth');
        } else if (user) {
            fetchProfile();
            fetchOrders(0);
            fetchActivities();
        }
    }, [user, authLoading, router, fetchProfile, fetchOrders, fetchActivities]);

    // Handlers
    const handleLogout = async () => {
        await logout();
        router.push('/auth');
    };

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        try {
            const changedFields: Record<string, any> = {};
            if (formData.name !== initialFormData?.name) changedFields.name = formData.name;
            if (formData.phone !== initialFormData?.phone) changedFields.phone = formData.phone;
            if (formData.street !== initialFormData?.street) changedFields.street = formData.street;
            if (formData.city !== initialFormData?.city) changedFields.city = formData.city;
            if (formData.zip !== initialFormData?.zip) changedFields.zip = formData.zip;
            if (formData.country_id !== initialFormData?.country_id) changedFields.country_id = formData.country_id;
            if (formData.state_id !== initialFormData?.state_id) changedFields.state_id = formData.state_id;

            if (formData.image_1920 !== initialFormData?.image_1920) {
                const base64Content = formData.image_1920.includes('base64,')
                    ? formData.image_1920.split('base64,')[1]
                    : formData.image_1920;
                changedFields.image_1920 = base64Content;
            }

            if (Object.keys(changedFields).length === 0) {
                setIsEditingProfile(false);
                setIsSavingProfile(false);
                return;
            }

            const res = await fetch('/api/odoo/restaurant/profile/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...changedFields, email: user?.email })
            });

            if (!res.ok) throw new Error('Failed to update profile');

            toast.success(tProfile('updateSuccess'));
            setIsEditingProfile(false);
            await refreshUser();
            fetchProfile();
        } catch (error) {
            toast.error(tProfile('updateError'));
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleCancelBooking = async (token: string, id: number) => {
        if (!confirm(tBookings('confirmCancel'))) return;
        setCancellingBookingId(id);
        try {
            const res = (await odoo.cancelTableBooking(token)) as any;
            if (res.status === 'success') {
                toast.success(tBookings('cancelSuccess'));
                fetchActivities();
            } else {
                toast.error(res.message || tBookings('cancelError'));
            }
        } catch (error) {
            toast.error(tBookings('cancelError'));
        } finally {
            setCancellingBookingId(null);
        }
    };

    const handleDownloadHistoryInvoice = async (orderRef: string, orderId: number) => {
        try {
            toast.loading(tTrack('downloadInvoice') || "Generating invoice...");
            const response = await fetch(`/api/odoo/restaurant/orders/${encodeURIComponent(orderRef)}`);
            const data = await response.json();
            toast.dismiss();
            if (data.order && data.order.line_items) {
                generateInvoice({ order: data.order });
            } else {
                toast.error("Items missing. Cannot generate PDF.");
            }
        } catch (e) {
            toast.dismiss();
            toast.error("Failed to download invoice.");
        }
    };

    // Shared UI Components
    const LoadingSkeleton = () => (
        <div className="container mx-auto px-4 py-32 max-w-6xl space-y-8">
            <Skeleton className="h-40 w-full rounded-[2.5rem]" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <Skeleton className="h-64 rounded-[2.5rem]" />
                <Skeleton className="h-64 md:col-span-3 rounded-[2.5rem]" />
            </div>
        </div>
    );

    if (authLoading) return <LoadingSkeleton />;
    if (!user) return null;

    return (
        <div className="min-h-screen pt-32 pb-20 bg-neutral-950 text-white selection:bg-accent-gold selection:text-primary">
            <div className="w-full px-4 md:px-8 lg:px-12 max-w-[1920px] mx-auto">
                {/* Header Welcome Card */}
                <div className="relative mb-12">
                    <div className="absolute inset-x-0 -top-20 h-64 bg-accent-gold/5 blur-[100px] -z-10" />
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-[2rem] bg-neutral-900 p-1.5 shadow-2xl shadow-black ring-1 ring-white/10">
                                    <div className="w-full h-full rounded-[1.7rem] bg-neutral-800 flex items-center justify-center text-accent-gold overflow-hidden">
                                        {formData.image_1920 ? (
                                            <Image src={formData.image_1920} width={100} height={100} alt="Profile" className="w-full h-full object-cover" />
                                        ) : user?.image ? (
                                            <img src={user.image} alt={user.name!} className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={32} />
                                        )}
                                    </div>
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-green-500 border-4 border-neutral-950 w-6 h-6 rounded-full shadow-xl" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold font-display text-white mb-2">{t('welcome', { name: user.name })}</h1>
                                <div className="text-white/50 font-medium text-sm flex items-center gap-2">
                                    <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full text-accent-gold">
                                        {tProfile('memberStatus')}
                                    </Badge>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {user.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="rounded-2xl h-11 border-white/10 text-white/70 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all" onClick={handleLogout}>
                                <LogOut className="w-4 h-4 mr-2" /> {tProfile('signOut')}
                            </Button>
                            <Button className="rounded-2xl h-11 bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold shadow-lg shadow-accent-gold/20" onClick={() => {
                                setActiveTab('profile');
                                setIsEditingProfile(true);
                            }}>
                                <Edit3 className="w-4 h-4 mr-2" /> {tProfile('editProfile')}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Navigation Sidebar */}
                    <div className="md:col-span-3 space-y-6">
                        <div className="bg-neutral-900/50 rounded-[2rem] p-3 shadow-2xl shadow-black/20 border border-white/5 backdrop-blur-xl space-y-1">
                            {[
                                { id: 'overview', label: t('overview'), icon: RefreshCw },
                                { id: 'orders', label: t('orders'), icon: ShoppingBag },
                                { id: 'bookings', label: t('bookings'), icon: Calendar },
                                { id: 'profile', label: t('profile'), icon: User },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        setSelectedOrderId(null);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === item.id
                                        ? 'bg-accent-gold text-primary shadow-xl shadow-accent-gold/20 scale-[1.02]'
                                        : 'text-white/40 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Quick Stats Card */}
                        <Card className="rounded-[2rem] border-white/5 shadow-2xl shadow-black/20 bg-neutral-900/50 backdrop-blur-xl p-5 space-y-4 text-white">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">{t('quickStats')}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-sm transition-all hover:bg-white/10 group/stat">
                                    <div className="w-8 h-8 rounded-xl bg-neutral-900 shadow-sm flex items-center justify-center text-accent-gold group-hover/stat:scale-110 transition-transform">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] uppercase tracking-wider font-bold text-white/30 leading-none mb-1">{tProfile('status')}</p>
                                        <p className="text-[11px] font-bold text-white">{tProfile('verified')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-sm transition-all hover:bg-white/10 group/stat">
                                    <div className="w-8 h-8 rounded-xl bg-neutral-900 shadow-sm flex items-center justify-center text-accent-gold group-hover/stat:scale-110 transition-transform">
                                        <RefreshCw size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] uppercase tracking-wider font-bold text-white/30 leading-none mb-1">{tProfile('totalSpent')}</p>
                                        <p className="text-[11px] font-bold text-white">
                                            {isHistoryLoading ? '...' : formatPrice(orders.filter(o => ['paid', 'done', 'invoiced'].includes(o.state)).reduce((s, o) => s + (o.amount_total || 0), 0))}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Content Area */}
                    <div className="md:col-span-9">
                        <Tabs value={activeTab} className="w-full">
                            <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Overview Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Active Order Card */}
                                    <Card className="rounded-[2.5rem] border-white/5 bg-neutral-900 shadow-2xl overflow-hidden group">
                                        <CardHeader className="bg-neutral-950 p-6 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                                                    <ShoppingBag size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-display font-bold text-white uppercase tracking-wider text-sm">{t('activeOrder')}</h3>
                                                    <p className="text-[10px] text-white/40 font-bold tracking-widest">{activities.orders.length > 0 ? (activities.orders[0].pos_reference || activities.orders[0].ref || activities.orders[0].name) : tProfile('noOrders')}</p>
                                                </div>
                                            </div>
                                            {/* <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-accent-gold transition-colors">
                                                <ShoppingBag size={18} />
                                            </div> */}
                                        </CardHeader>
                                        <CardContent className="p-8 space-y-8 bg-neutral-900/40">
                                            {activities.orders.length > 0 ? (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">{tProfile('status')}</p>
                                                            <Badge className="bg-accent-gold text-primary border-none px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent-gold/20">
                                                                {activities.orders[0].delivery_status || 'received'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" className="w-full rounded-2xl h-12 border-white/10 text-white font-bold hover:bg-accent-gold hover:text-primary hover:border-accent-gold transition-all shadow-xl" onClick={() => {
                                                        setSelectedOrderId(activities.orders[0].pos_reference || activities.orders[0].ref || activities.orders[0].name);
                                                        setActiveTab('orders');
                                                    }}>
                                                        {tTrack('goToTracking')} <ChevronRight className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="py-4 space-y-4 text-center">
                                                    <p className="text-sm text-white/40 font-medium">{tProfile('noOrdersDesc')}</p>
                                                    <Button className="rounded-2xl bg-accent-gold hover:bg-accent-gold/90 text-primary font-bold px-8 h-12 shadow-lg shadow-accent-gold/20" onClick={() => router.push('/menu')}>
                                                        {tProfile('orderNow')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Next Booking Card */}
                                    <Card className="rounded-[2.5rem] border-white/5 bg-neutral-900 shadow-2xl overflow-hidden group">
                                        <CardHeader className="bg-accent-gold p-6 text-primary border-b border-accent-gold/10">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-display font-bold uppercase tracking-wider text-sm">{t('nextBooking')}</h3>
                                                        <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">
                                                            {activities.bookings.length > 0 ? activities.bookings[0].ref : t('noActiveBookings')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity">
                                                    <Calendar size={18} />
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-8 bg-neutral-900/40 min-h-[180px] flex flex-col justify-center">
                                            {activities.bookings.length > 0 ? (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-white/5 text-accent-gold"><Calendar size={14} /></div>
                                                            <div className="text-[11px] font-bold text-white whitespace-nowrap">{new Date(activities.bookings[0].start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-white/5 text-accent-gold"><Clock size={14} /></div>
                                                            <div className="text-[11px] font-bold text-white">{new Date(activities.bookings[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-white/5 text-accent-gold"><User size={14} /></div>
                                                            <div className="text-[11px] font-bold text-white">{activities.bookings[0].party_size} {tBookings('people')}</div>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" className="w-full rounded-2xl h-12 border-white/10 text-white font-bold hover:bg-white hover:text-primary transition-all shadow-xl" onClick={() => setActiveTab('bookings')}>
                                                        {tBookings('bookings')} <ChevronRight className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="py-2 space-y-4 text-center">
                                                    <p className="text-sm text-white/40 font-medium">{tBookings('noBookingsDesc')}</p>
                                                    <Button variant="outline" className="rounded-2xl border-white/20 text-white hover:bg-white hover:text-primary font-bold px-8 h-12 transition-all shadow-xl" onClick={() => router.push('/booking')}>
                                                        {tBookings('bookNow')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Welcome Content Card */}
                                <Card className="rounded-[2.5rem] border-white/5 shadow-2xl shadow-black/20 bg-neutral-900/50 backdrop-blur-xl p-10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                                        <ChefHat size={180} className="text-accent-gold" />
                                    </div>
                                    <div className="relative z-10 max-w-2xl space-y-6">
                                        <h3 className="text-3xl font-bold font-display text-white underline decoration-accent-gold/30 decoration-8 underline-offset-4 tracking-tight">{t('manageAccount')}</h3>
                                        <p className="text-white/60 leading-relaxed font-medium text-lg">
                                            Namaste! Experience seamless management of your culinary journey at <span className="text-accent-gold font-bold">RAM & CO</span>. Track live orders, manage table reservations, and keep your preferences up to date all in one premium portal.
                                        </p>
                                    </div>
                                </Card>
                            </TabsContent>

                            <TabsContent value="orders" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Post-payment order syncing overlay */}
                                {postPaymentStatus !== 'idle' && !selectedOrderId && (
                                    <div className="mb-8 p-8 rounded-[2.5rem] bg-neutral-900/80 backdrop-blur-xl border border-white/10 text-center space-y-4 animate-in fade-in zoom-in duration-500">
                                        {postPaymentStatus === 'syncing' && (
                                            <>
                                                <div className="relative w-20 h-20 mx-auto">
                                                    <div className="absolute inset-0 bg-accent-gold/20 rounded-full animate-ping" />
                                                    <div className="relative bg-accent-gold text-primary w-20 h-20 rounded-full flex items-center justify-center shadow-2xl">
                                                        <Loader2 className="w-10 h-10 animate-spin" />
                                                    </div>
                                                </div>
                                                <h3 className="text-xl font-bold text-white font-display">{tTrack('transmitting')}</h3>
                                                <p className="text-sm text-white/40">{tTrack('transmittingDesc')}</p>
                                            </>
                                        )}
                                        {postPaymentStatus === 'found' && (
                                            <>
                                                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl animate-in zoom-in duration-300">
                                                    <CheckCircle2 className="w-10 h-10" />
                                                </div>
                                                <h3 className="text-xl font-bold text-white font-display">{tTrack('orderConfirmed')}</h3>
                                                <p className="text-sm text-white/40">{tTrack('redirecting')}</p>
                                            </>
                                        )}
                                        {postPaymentStatus === 'error' && (
                                            <>
                                                <div className="w-20 h-20 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center mx-auto">
                                                    <Package className="w-10 h-10" />
                                                </div>
                                                <h3 className="text-xl font-bold text-white font-display">{tTrack('syncDelay')}</h3>
                                                <p className="text-sm text-white/40">{tTrack('syncDelayDesc')}</p>
                                                <Button variant="outline" className="rounded-2xl border-white/10 text-white hover:bg-white hover:text-primary" onClick={() => { setPostPaymentStatus('idle'); fetchOrders(0); }}>
                                                    {t('refresh')}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                                {selectedOrderId ? (
                                    <div className="space-y-8">
                                        {/* Tracking View */}
                                        <div className="flex items-center justify-between mb-4">
                                            <Button variant="ghost" className="text-white/40 hover:text-accent-gold font-black uppercase tracking-widest text-[10px] h-10 px-4 rounded-xl hover:bg-white/5 transition-all" onClick={() => setSelectedOrderId(null)}>
                                                <ChevronLeft size={16} className="mr-2" /> {tTrack('backHistory')}
                                            </Button>
                                            <Badge className="bg-white/5 text-accent-gold border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl">
                                                {tTrack('receipt')}: {trackingOrder?.pos_reference || selectedOrderId}
                                            </Badge>
                                        </div>

                                        {isTrackingLoading ? (
                                            <Skeleton className="h-[500px] w-full rounded-[3rem]" />
                                        ) : trackingOrder ? (
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                                <div className="lg:col-span-2 space-y-8">
                                                    <Card className="rounded-[3rem] border-white/5 shadow-2xl overflow-hidden bg-neutral-900/80 backdrop-blur-xl">
                                                        <CardHeader className="bg-neutral-950 text-white p-10 relative border-b border-white/5">
                                                            <div className="relative z-10 flex justify-between items-center">
                                                                <div>
                                                                    <CardTitle className="text-3xl font-display font-bold text-white tracking-tight">{tTrack('realTimeCheck')}</CardTitle>
                                                                    <CardDescription className="text-white/40 text-lg font-medium">{trackingStatus ? tTrack('currently', { status: tTrack(trackingStatus) }) : ''}</CardDescription>
                                                                </div>
                                                                <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
                                                                    <Clock className="w-8 h-8 text-accent-gold" />
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="p-10 space-y-12">
                                                            <div className="relative pt-10 pb-6">
                                                                <Progress value={trackingProgress} className="h-3 bg-white/5 [&>div]:bg-accent-gold" />
                                                                <div className="flex justify-between mt-8">
                                                                    {STATUS_STEPS.map((step, idx) => {
                                                                        const Icon = step.icon;
                                                                        const stepIdx = STATUS_STEPS.findIndex(s => s.status === trackingStatus);
                                                                        const isActive = stepIdx >= idx;
                                                                        const isCurrent = step.status === trackingStatus;

                                                                        return (
                                                                            <div key={step.status} className="flex flex-col items-center gap-3">
                                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-xl
                                                                                    ${isActive ? 'bg-accent-gold text-primary shadow-accent-gold/20 scale-110' : 'bg-white/5 text-white/20 border border-white/5'}
                                                                                    ${isCurrent ? 'ring-4 ring-accent-gold/20 animate-pulse' : ''}`}>
                                                                                    <Icon size={20} />
                                                                                </div>
                                                                                <span className={`text-[9px] font-black uppercase tracking-widest text-center max-w-[80px]
                                                                                    ${isActive ? 'text-accent-gold' : 'text-white/20'}`}>
                                                                                    {tTrack(step.key)}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <Separator className="bg-white/5" />

                                                            <div className="flex items-start gap-5 p-6 bg-white/5 rounded-3xl border border-white/10 transition-all hover:bg-white/10 px-8">
                                                                <div className="p-3 bg-accent-gold text-primary rounded-2xl shadow-lg shadow-accent-gold/20 flex-shrink-0">
                                                                    <MapPin size={24} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <p className="font-bold text-lg font-display text-white">{tTrack('deliveryAddress')}</p>
                                                                    <div className="text-white/60 font-medium text-sm space-y-0.5">
                                                                        <p className="text-white font-bold mb-1">{trackingOrder.partner_detail?.name || tTrack('noName')}</p>
                                                                        <p>{trackingOrder.partner_detail?.street}</p>
                                                                        <p>{trackingOrder.partner_detail?.city}, {trackingOrder.partner_detail?.zip}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    {/* Chef/Support card - As requested by user */}
                                                    <Card className="rounded-[2.5rem] border-white/5 shadow-2xl bg-neutral-900/50 backdrop-blur-xl">
                                                        <CardContent className="p-8">
                                                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                                                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-accent-gold/10">
                                                                    <Image src="https://picsum.photos/seed/chef-arjun/300/300" alt="Executive Chef" fill className="object-cover" />
                                                                </div>
                                                                <div className="flex-1 space-y-1 text-center sm:text-left">
                                                                    <p className="text-[10px] font-bold text-accent-gold uppercase tracking-widest">{tTrack('tandoorMaster')}</p>
                                                                    <h3 className="text-2xl font-display font-bold text-white tracking-tight">{tTrack('masterChef')}</h3>
                                                                    <div className="flex items-center justify-center sm:justify-start gap-2 text-green-500 text-xs font-bold">
                                                                        <CheckCircle2 size={14} className="fill-current" />
                                                                        <span>{tTrack('verifiedPartner')}</span>
                                                                    </div>
                                                                </div>
                                                                <Button variant="outline" className="rounded-full px-10 h-14 border-accent-gold/50 text-accent-gold hover:bg-accent-gold hover:text-primary font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-accent-gold/5">
                                                                    {tTrack('supportChat')}
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                <div className="space-y-8">
                                                    <Card className="rounded-[2.5rem] border-white/5 shadow-2xl bg-neutral-900/50 backdrop-blur-xl overflow-hidden">
                                                        <div className="p-6 bg-neutral-950/50 border-b border-white/5">
                                                            <h3 className="font-display text-white text-xl font-bold flex items-center gap-2 tracking-tight">
                                                                <Receipt size={18} className="text-accent-gold" /> {tTrack('itemsSummary')}
                                                            </h3>
                                                        </div>
                                                        <ScrollArea className="h-[45vh] w-full">
                                                            <CardContent className="p-6">
                                                                <div className="space-y-4">
                                                                    {trackingOrder.line_items?.map((item: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 group/item transition-all hover:bg-white/10">
                                                                            <div className="flex items-start gap-3">
                                                                                <span className="w-6 h-6 rounded-lg bg-accent-gold text-primary text-[10px] font-black flex items-center justify-center mt-0.5 shadow-lg shadow-accent-gold/20">{item.qty}×</span>
                                                                                <p className="text-xs font-bold text-white transition-colors group-hover/item:text-accent-gold leading-tight">{translate(item.full_product_name || item.product_id[1])}</p>
                                                                            </div>
                                                                            <span className="text-xs font-bold text-white/80">{formatPrice(item.price_subtotal_incl)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </ScrollArea>
                                                        <div className="p-6 space-y-3 bg-neutral-950/50 border-t border-white/5">
                                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/30">
                                                                <span>{tTrack('totalPaid')}</span>
                                                                <span className="text-2xl font-display font-bold text-accent-gold">{formatPrice(trackingOrder.amount_total)}</span>
                                                            </div>
                                                            {['paid', 'done', 'invoiced'].includes(trackingOrder.state) && (
                                                                <Button 
                                                                    variant="outline" 
                                                                    className="w-full mt-4 rounded-2xl border-white/10 text-white hover:bg-white/5 h-12 font-bold flex items-center justify-center gap-2"
                                                                    onClick={() => generateInvoice({ order: trackingOrder })}
                                                                >
                                                                    <Receipt size={18} /> {tTrack('downloadInvoice') || 'Download Invoice'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </Card>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-20 text-center">
                                                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                                <p className="font-bold">{tTrack('orderNotFound')}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Card className="rounded-[2.5rem] border-white/5 shadow-2xl bg-neutral-900/50 backdrop-blur-xl p-6 md:p-10">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                                            <div>
                                                <h3 className="text-3xl font-display font-bold text-white tracking-tight">{tProfile('orderHistory')}</h3>
                                                <p className="text-sm text-white/40 font-medium">{tProfile('culinaryJourney')}</p>
                                            </div>
                                            <Button variant="outline" className="rounded-2xl border-white/10 text-white font-bold hover:bg-white/5 h-12 px-6 transition-all" onClick={() => fetchOrders(orderPage)}>
                                                <RefreshCw size={16} className="mr-2" /> {tProfile('refresh')}
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {isHistoryLoading ? (
                                                [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                                            ) : orders.length > 0 ? (
                                                <>
                                                    <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 bg-white/5 rounded-2xl mb-4 border border-white/5">
                                                        <div className="col-span-4">Order Reference</div>
                                                        <div className="col-span-2">Payment</div>
                                                        <div className="col-span-2">Status</div>
                                                        <div className="col-span-2 text-right">Amount</div>
                                                        <div className="col-span-2 text-right">Action</div>
                                                    </div>

                                                    {orders.map((order) => (
                                                        <div key={order.id} className="group grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-6 rounded-[2.5rem] bg-white/5 border border-white/5 hover:border-accent-gold/30 hover:bg-white/10 transition-all duration-300 shadow-xl">
                                                            <div className="col-span-4 flex items-center gap-5">
                                                                <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-white/5 flex items-center justify-center text-accent-gold font-bold transition-all group-hover:scale-110 shadow-lg group-hover:shadow-accent-gold/5">
                                                                    <ShoppingBag size={22} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-white group-hover:text-accent-gold transition-colors">{order.pos_reference || order.name}</p>
                                                                    {order.pos_reference && order.name && order.pos_reference !== order.name && (
                                                                        <p className="text-[9px] text-white/20 font-medium uppercase tracking-tighter mt-0.5">{order.name}</p>
                                                                    )}
                                                                    <p className="text-[10px] text-white/40 flex items-center gap-1.5 mt-1 font-black uppercase tracking-wider">
                                                                        <Clock size={12} /> {new Date(order.date_order).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="col-span-2">
                                                                <Badge className={`text-[9px] uppercase font-black tracking-widest border-none px-4 py-1.5 rounded-full ${['paid', 'done', 'invoiced'].includes(order.state) ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                                    {order.state}
                                                                </Badge>
                                                            </div>

                                                            <div className="col-span-2">
                                                                <Badge className={`text-[9px] uppercase font-black tracking-widest border-none px-4 py-1.5 rounded-full ${order.delivery_status === 'delivering' || order.delivery_status === 'delivered' ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/30'}`}>
                                                                    {tTrack(order.delivery_status || 'wait') || order.delivery_status || 'Wait'}
                                                                </Badge>
                                                            </div>

                                                            <div className="col-span-2 md:text-right">
                                                                <p className="text-lg font-display font-bold text-white">{formatPrice(order.amount_total)}</p>
                                                            </div>

                                                            <div className="col-span-2 flex items-center justify-end gap-3">
                                                                {['paid', 'done', 'invoiced'].includes(order.state) && (
                                                                    <button onClick={() => handleDownloadHistoryInvoice(order.pos_reference || order.name, order.id)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-accent-gold hover:border-accent-gold/50 transition-all shadow-xl">
                                                                        <Receipt size={18} />
                                                                    </button>
                                                                )}
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => setSelectedOrderId(order.pos_reference || order.name || String(order.id))}
                                                                    className="w-12 h-12 rounded-xl bg-accent-gold border-none text-primary hover:bg-white hover:text-primary transition-all shadow-2xl shadow-accent-gold/20"
                                                                >
                                                                    <ChevronRight size={20} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Pagination */}
                                                    <div className="flex flex-col sm:flex-row justify-between items-center mt-12 pt-8 border-t border-white/5 gap-6">
                                                        <p className="text-xs font-black uppercase tracking-widest text-white/20">
                                                            Showing {orderPage * orderLimit + 1} to {Math.min((orderPage + 1) * orderLimit, totalOrders)} of {totalOrders}
                                                        </p>
                                                        <div className="flex gap-4">
                                                            <Button variant="outline" className="rounded-2xl border-white/10 text-white hover:bg-white/5 h-12 px-8 font-bold transition-all" onClick={() => {
                                                                const newP = Math.max(0, orderPage - 1);
                                                                setOrderPage(newP);
                                                                fetchOrders(newP);
                                                            }} disabled={orderPage === 0}>{t('prev') || 'Previous'}</Button>
                                                            <Button variant="outline" className="rounded-2xl border-white/10 text-white hover:bg-white/5 h-12 px-8 font-bold transition-all" onClick={() => {
                                                                const newP = Math.min(Math.ceil(totalOrders / orderLimit) - 1, orderPage + 1);
                                                                setOrderPage(newP);
                                                                fetchOrders(newP);
                                                            }} disabled={orderPage >= Math.ceil(totalOrders / orderLimit) - 1}>{t('next') || 'Next'}</Button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                                                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-white/10 border border-white/5">
                                                        <ShoppingBag size={48} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xl font-display font-bold text-white">{tProfile('noOrders')}</p>
                                                        <p className="text-sm text-white/40 max-w-xs font-medium leading-relaxed">{tProfile('noOrdersDesc')}</p>
                                                    </div>
                                                    <Button className="rounded-2xl bg-accent-gold hover:bg-accent-gold/90 text-primary font-black uppercase tracking-widest px-10 h-14 shadow-2xl shadow-accent-gold/20" onClick={() => router.push('/menu')}>
                                                        {tProfile('orderNow')}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )}
                            </TabsContent>

                            <TabsContent value="bookings" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Card className="rounded-[2.5rem] border-white/5 shadow-2xl bg-neutral-900/50 backdrop-blur-xl p-6 md:p-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                        <div className="space-y-1">
                                            <h3 className="text-3xl font-display font-bold text-white tracking-tight">{tBookings('bookings')}</h3>
                                            <p className="text-sm text-white/40 font-medium">{tBookings('subtitle')}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                                            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
                                                <button onClick={() => { setBookingFilter('upcoming'); setBookingPage(0); }} className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${bookingFilter === 'upcoming' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Upcoming</button>
                                                <button onClick={() => { setBookingFilter('previous'); setBookingPage(0); }} className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${bookingFilter === 'previous' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Previous</button>
                                            </div>
                                            <Button variant="outline" className="rounded-2xl border-white/10 text-white font-bold hover:bg-white/5 h-12 md:h-14 px-4 md:px-6 transition-all" onClick={() => fetchActivities()}>
                                                <RefreshCw size={18} className={isLoadingActivities ? "animate-spin mr-2" : "mr-2"} /> <span className="hidden md:inline">{tProfile('refresh')}</span>
                                            </Button>
                                            <Button className="rounded-2xl h-12 md:h-14 bg-accent-gold hover:bg-accent-gold/90 text-primary font-black uppercase tracking-widest px-6 md:px-10 shadow-2xl shadow-accent-gold/20 flex items-center gap-2 transition-all" onClick={() => router.push('/booking')}>
                                                <Calendar size={18} /> <span className="hidden md:inline">{tBookings('bookNow')}</span><span className="md:hidden">Book</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {isLoadingActivities ? (
                                            [1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                                        ) : filteredBookings.length > 0 ? (
                                            <>
                                            {paginatedBookings.map((booking) => {
                                                const bookingStart = new Date(booking.start_time);
                                                const isPast = bookingStart < new Date();
                                                const displayStatus = (booking.status === 'confirmed' && isPast) ? 'no_show' : booking.status;
                                                const canCancel = booking.cancel_token && displayStatus !== 'cancelled' && displayStatus !== 'no_show';
                                                
                                                return (
                                                <Card key={booking.id} className="relative bg-white/5 border border-white/5 hover:border-accent-gold/30 hover:bg-white/10 transition-all duration-300 group rounded-3xl overflow-hidden shadow-xl">
                                                    <div className="absolute top-0 right-0 p-4">
                                                        <Badge className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-none ${displayStatus === 'confirmed' ? 'bg-green-500/10 text-green-400' :
                                                            displayStatus === 'cancelled' || displayStatus === 'no_show' ? 'bg-red-500/10 text-red-400' :
                                                                'bg-white/5 text-white/40'
                                                            }`}>
                                                            {tBookings(displayStatus) || displayStatus.replace('_', ' ')}
                                                        </Badge>
                                                    </div>
                                                    <CardHeader className="pb-0 p-4">
                                                        <span className="text-[9px] font-black tracking-[0.3em] text-accent-gold uppercase mb-1">#{booking.name}</span>
                                                        <CardTitle className="text-lg font-display font-bold text-white group-hover:text-accent-gold transition-colors tracking-tight">{booking.config_name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-3 flex flex-col md:flex-row md:items-end justify-between gap-4">
                                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                                            {[
                                                                { label: tBookings('date'), val: new Date(booking.start_time).toLocaleDateString(), icon: Calendar },
                                                                { label: tBookings('time'), val: new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), icon: Clock },
                                                                { label: tBookings('guests'), val: `${booking.party_size} ${tBookings('people')}`, icon: User },
                                                                { label: tBookings('tables'), val: booking.tables.join(', '), icon: Utensils },
                                                            ].map((info, i) => (
                                                                <div key={i} className="flex items-center gap-1.5 opacity-80">
                                                                    <info.icon className="w-3.5 h-3.5 text-accent-gold shrink-0" />
                                                                    <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">{info.label}: <span className="text-white font-bold tracking-normal ml-0.5">{info.val}</span></span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {canCancel && (
                                                            <Button variant="ghost" className="text-white/40 hover:text-red-400 hover:bg-red-400/10 font-black uppercase tracking-widest text-[9px] rounded-lg h-8 px-4 transition-all shrink-0 w-full md:w-auto mt-2 md:mt-0" onClick={() => handleCancelBooking(booking.cancel_token, booking.id)} disabled={cancellingBookingId === booking.id}>
                                                                {cancellingBookingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <XCircle className="w-3.5 h-3.5 mr-2" />}
                                                                {tBookings('cancelBooking')}
                                                            </Button>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )})}
                                            
                                            {/* Pagination */}
                                            {totalBookingPages > 1 && (
                                                <div className="flex justify-center items-center gap-2 pt-6">
                                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5" onClick={() => setBookingPage(p => Math.max(0, p - 1))} disabled={bookingPage === 0}>
                                                        <ChevronLeft size={18} />
                                                    </Button>
                                                    <div className="text-xs font-bold text-white/60 tracking-widest">
                                                        {bookingPage + 1} / {totalBookingPages}
                                                    </div>
                                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5" onClick={() => setBookingPage(p => Math.min(totalBookingPages - 1, p + 1))} disabled={bookingPage >= totalBookingPages - 1}>
                                                        <ChevronRight size={18} />
                                                    </Button>
                                                </div>
                                            )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 rounded-[3rem] bg-white/5 border-2 border-dashed border-white/10">
                                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20 border border-white/5">
                                                    <Calendar className="w-10 h-10" />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xl font-display font-bold text-white">{tBookings('noBookings')}</p>
                                                    <p className="text-sm text-white/40 max-w-xs font-medium">{tBookings('noBookingsDesc')}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </TabsContent>

                            <TabsContent value="profile" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Card className="rounded-[2.5rem] border-white/5 shadow-2xl bg-neutral-900/50 backdrop-blur-xl p-6 md:p-10">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                                        <div className="space-y-1">
                                            <h3 className="text-3xl font-display font-bold text-white tracking-tight">{tProfile('accountInfo')}</h3>
                                            <p className="text-sm text-white/40 font-medium">{t('manageAccount')}</p>
                                        </div>
                                        {!isEditingProfile ? (
                                            <Button variant="outline" className="rounded-2xl border-white/10 text-white h-12 px-8 font-bold hover:bg-white/5 hover:text-white transition-all shadow-xl" onClick={() => setIsEditingProfile(true)}>
                                                <Edit3 className="w-4 h-4 mr-2" /> {tProfile('editProfile')}
                                            </Button>
                                        ) : (
                                            <div className="flex gap-4">
                                                <Button variant="ghost" className="rounded-2xl h-12 px-6 text-white/40 hover:text-white hover:bg-white/5 transition-all" onClick={() => setIsEditingProfile(false)}>
                                                    <X className="w-4 h-4 mr-2" /> {tProfile('cancel')}
                                                </Button>
                                                <Button className="rounded-2xl h-12 px-8 bg-accent-gold hover:bg-accent-gold/90 text-primary font-black uppercase tracking-widest text-xs shadow-2xl shadow-accent-gold/20 transition-all" onClick={handleSaveProfile} disabled={isSavingProfile}>
                                                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {tProfile('saveChanges')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {/* Profile Picture */}
                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('profilePicture') || 'Profile Picture'}</Label>
                                                <div className="relative group w-48 h-48 mx-auto md:mx-0">
                                                    <div className="w-full h-full rounded-[3rem] bg-neutral-900 flex items-center justify-center text-accent-gold overflow-hidden border-4 border-white/10 shadow-2xl transition-all group-hover:scale-105 duration-700 group-hover:border-accent-gold/50">
                                                        {formData.image_1920 ? (
                                                            <Image src={formData.image_1920} width={400} height={400} alt="Profile" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User size={80} className="opacity-20" />
                                                        )}
                                                    </div>
                                                    {isEditingProfile && (
                                                        <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center rounded-[3rem] bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                                                            <Camera size={40} className="scale-75 group-hover:scale-100 transition-transform duration-500" />
                                                        </button>
                                                    )}
                                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setFormData(p => ({ ...p, image_1920: reader.result as string }));
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('name')}</Label>
                                                    <Input value={formData.name} disabled={!isEditingProfile} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl focus:border-accent-gold transition-all font-bold text-white disabled:opacity-40" />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('phone')}</Label>
                                                    <Input value={formData.phone} disabled={!isEditingProfile} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl focus:border-accent-gold transition-all font-bold text-white disabled:opacity-40" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Address Info */}
                                        <div className="space-y-8">
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('street')}</Label>
                                                <Input value={formData.street} disabled={!isEditingProfile} onChange={e => setFormData(p => ({ ...p, street: e.target.value }))} className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl focus:border-accent-gold transition-all font-bold text-white disabled:opacity-40" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('city')}</Label>
                                                    <Input value={formData.city} disabled={!isEditingProfile} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl focus:border-accent-gold transition-all font-bold text-white disabled:opacity-40" />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('zip')}</Label>
                                                    <Input value={formData.zip} disabled={!isEditingProfile} onChange={e => setFormData(p => ({ ...p, zip: e.target.value }))} className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl focus:border-accent-gold transition-all font-bold text-white disabled:opacity-40" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('country')}</Label>
                                                    <Select value={formData.country_id?.toString()} disabled={!isEditingProfile} onValueChange={v => setFormData(p => ({ ...p, country_id: parseInt(v), state_id: '' }))}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl font-bold focus:bg-white/10 transition-all text-white disabled:opacity-40">
                                                            <SelectValue placeholder={tProfile('selectCountry')} />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                                            {countries.map(c => <SelectItem key={c.id} value={c.id.toString()} className="focus:bg-white/5 focus:text-accent-gold">{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{tProfile('state')}</Label>
                                                    <Select value={formData.state_id?.toString()} disabled={!isEditingProfile || !formData.country_id} onValueChange={v => setFormData(p => ({ ...p, state_id: parseInt(v) }))}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white/5 shadow-xl font-bold focus:bg-white/10 transition-all text-white disabled:opacity-40">
                                                            <SelectValue placeholder={tProfile('selectState')} />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                                            {states.map(s => <SelectItem key={s.id} value={s.id.toString()} className="focus:bg-white/5 focus:text-accent-gold">{s.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}
