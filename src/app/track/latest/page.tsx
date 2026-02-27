"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChefHat, CheckCircle2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function TrackLatestOrderPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [status, setStatus] = useState<'searching' | 'found' | 'error'>('searching');

    useEffect(() => {
        if (!user?.email) {
            const timer = setTimeout(() => setStatus('error'), 5000);
            return () => clearTimeout(timer);
        }

        let attempts = 0;
        const maxAttempts = 10;

        const pollOrder = async () => {
            try {
                const res = await fetch(`/api/track/latest?email=${encodeURIComponent(user.email)}`);
                if (res.ok) {
                    const order = await res.json();
                    if (order.id) {
                        setStatus('found');
                        setTimeout(() => router.push(`/track/${order.id}`), 1000);
                        return true;
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
            return false;
        };

        const interval = setInterval(async () => {
            attempts++;
            const found = await pollOrder();
            if (found || attempts >= maxAttempts) {
                clearInterval(interval);
                if (!found) setStatus('error');
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [user, router]);

    return (
        <div className="container mx-auto px-4 py-40 text-center max-w-lg">
            {status === 'searching' && (
                <div className="space-y-8 animate-pulse">
                    <div className="relative w-32 h-32 mx-auto">
                        <Loader2 className="w-32 h-32 text-accent-gold animate-spin" />
                        <ChefHat className="absolute inset-0 m-auto w-12 h-12 text-accent-gold" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold font-headline">Transmitting your request...</h1>
                        <p className="text-muted-foreground">We've received your payment! Our secure bridge is now creating your order in the kitchen's system.</p>
                    </div>
                </div>
            )}

            {status === 'found' && (
                <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl">
                        <CheckCircle2 className="w-16 h-16" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold font-headline">Order Confirmed!</h1>
                        <p className="text-muted-foreground">Redirecting you to the live tracking dashboard...</p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="space-y-8">
                    <div className="w-32 h-32 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <Search className="w-12 h-12" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold font-headline">Order Sync Delay</h1>
                        <p className="text-muted-foreground">Your payment was successful, but we're taking a bit longer to sync with the kitchen. Please check your email or visit the tracking page in a moment.</p>
                        <button
                            onClick={() => router.push('/track')}
                            className="text-accent-gold font-bold underline"
                        >
                            Go to Tracking
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
