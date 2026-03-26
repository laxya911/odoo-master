"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/context/CompanyContext';
import { odoo } from '@/lib/odoo';
import { useTranslations } from 'next-intl';
import { 
  Calendar, 
  Clock, 
  Users, 
  Table as TableIcon, 
  ChevronRight, 
  XCircle, 
  CheckCircle2, 
  History, 
  Loader2, 
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Link from 'next/link';

interface BookingActivity {
  id: number;
  name: string;
  status: string;
  start_time: string;
  party_size: number;
  tables: string[];
  cancel_token: string | false;
  config_name: string;
}

interface OrderActivity {
  id: number;
  ref: string;
  date: string;
  total: number;
  state: string;
  delivery_status: string;
  uuid: string | false;
}

export default function MyBookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { formatPrice } = useCompany();
  const t = useTranslations('myBookings');
  const [activities, setActivities] = useState<{ bookings: BookingActivity[], orders: OrderActivity[] }>({ bookings: [], orders: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
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
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, t]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (user?.email) {
      fetchActivities();
    }
  }, [user, authLoading, router, fetchActivities]);

  const handleCancelBooking = async (token: string, id: number) => {
    if (!confirm(t('confirmCancel'))) return;
    
    setCancellingId(id);
    try {
      const res = (await odoo.cancelTableBooking(token)) as any;
      if (res.status === 'success') {
        toast.success(t('cancelSuccess'));
        fetchActivities();
      } else {
        toast.error(res.message || t('cancelError'));
      }
    } catch (error) {
      toast.error(t('cancelError'));
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold px-3 py-1">{t('confirmed')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-bold px-3 py-1">{t('cancelled')}</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-bold px-3 py-1">{t('completed')}</Badge>;
      case 'draft':
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 font-bold px-3 py-1">{t('pending') || 'Pending'}</Badge>;
      default:
        return <Badge variant="outline" className="text-zinc-500 border-zinc-800">{status}</Badge>;
    }
  };

  if (authLoading || (isLoading && activities.bookings.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('fetching')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <Link href="/profile" className="flex items-center text-primary hover:text-primary/80 transition-colors mb-4 text-sm font-medium">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToProfile') || 'Back to Profile'}
            </Link>
            <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 text-white px-8 py-6 rounded-full text-lg font-semibold shadow-gold transition-all duration-300 transform hover:scale-105">
            <Link href="/booking">
              {t('bookNow')}
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-zinc-900/50 p-1 border border-zinc-800 rounded-xl">
            <TabsTrigger value="bookings" className="py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              {t('bookings')}
            </TabsTrigger>
            <TabsTrigger value="orders" className="py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <ShoppingBag className="w-4 h-4 mr-2" />
              {t('orders')}
            </TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            {activities.bookings.length === 0 ? (
              <Card className="bg-zinc-900/30 border-zinc-800/50 backdrop-blur-sm text-center py-20">
                <CardContent>
                  <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-6 opacity-20" />
                  <h3 className="text-xl font-semibold text-white mb-2">{t('noBookings')}</h3>
                  <p className="text-muted-foreground mb-8">{t('noBookingsDesc')}</p>
                  <Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                    <Link href="/booking">{t('bookNow')}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {activities.bookings.map((booking) => (
                  <Card key={booking.id} className="relative bg-zinc-900/40 border-zinc-800 hover:border-primary/30 transition-all duration-300 group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                       {getStatusBadge(booking.status)}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-primary mb-2">
                         <span className="text-xs font-mono tracking-widest uppercase opacity-70">#{booking.name}</span>
                      </div>
                      <CardTitle className="text-xl text-white group-hover:text-primary transition-colors">
                        {booking.config_name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('date')}</p>
                          <div className="flex items-center text-zinc-200">
                            <Calendar className="w-4 h-4 mr-2 text-primary/60" />
                            <span className="font-medium">{new Date(booking.start_time).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('time')}</p>
                          <div className="flex items-center text-zinc-200">
                            <Clock className="w-4 h-4 mr-2 text-primary/60" />
                            <span className="font-medium">{new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('guests')}</p>
                          <div className="flex items-center text-zinc-200">
                            <Users className="w-4 h-4 mr-2 text-primary/60" />
                            <span className="font-medium">{booking.party_size} {t('people') || 'People'}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('tables')}</p>
                          <div className="flex items-center text-zinc-200">
                            <TableIcon className="w-4 h-4 mr-2 text-primary/60" />
                            <span className="font-medium">{booking.tables.join(', ')}</span>
                          </div>
                        </div>
                      </div>

                      {booking.cancel_token && booking.status !== 'cancelled' && (
                        <div className="flex justify-end pt-4 border-t border-zinc-800/50">
                          <Button 
                            variant="ghost" 
                            className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            onClick={() => handleCancelBooking(booking.cancel_token as string, booking.id)}
                            disabled={cancellingId === booking.id}
                          >
                            {cancellingId === booking.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            {t('cancelBooking')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
             {activities.orders.length === 0 ? (
               <Card className="bg-zinc-900/30 border-zinc-800/50 backdrop-blur-sm text-center py-20">
                 <CardContent>
                   <ShoppingBag className="w-16 h-16 text-zinc-700 mx-auto mb-6 opacity-20" />
                   <h3 className="text-xl font-semibold text-white mb-2">{t('noOrders') || 'No orders yet'}</h3>
                   <p className="text-muted-foreground mb-8">{t('noOrdersDesc') || 'Explore our menu and place your first order.'}</p>
                   <Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                     <Link href="/menu">{t('orderNow') || 'Order Now'}</Link>
                   </Button>
                 </CardContent>
               </Card>
             ) : (
               <div className="grid gap-4">
                 {activities.orders.map((order) => (
                   <Card key={order.id} className="bg-zinc-900/40 border-zinc-800 hover:border-primary/20 transition-all duration-300 group">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-white">{order.ref}</h4>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-tighter opacity-70">
                                {order.delivery_status}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500">
                              {new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between md:justify-end gap-8">
                          <div className="text-right">
                            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{t('total')}</p>
                            <p className="text-lg font-bold text-white">{formatPrice(order.total)}</p>
                          </div>
                          <Button asChild variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-full group">
                            <Link href={`/track/${order.ref}`}>
                              <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                   </Card>
                 ))}
               </div>
             )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
