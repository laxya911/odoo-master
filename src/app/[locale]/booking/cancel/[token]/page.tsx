'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { odoo } from '@/lib/odoo';
import { useTranslations } from 'next-intl';

export default function BookingCancelPage() {
  const t = useTranslations('booking');
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleCancel = async () => {
    setStatus('loading');
    try {
      const res: any = await odoo.cancelTableBooking(token);
      if (res.status === 'success') {
        setStatus('success');
        setMessage(res.message || 'Your reservation has been cancelled.');
      } else {
        setStatus('error');
        setMessage(res.message || 'Failed to cancel reservation.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An error occurred.');
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-8 md:p-12 rounded-[40px] border border-white/10 max-w-lg w-full text-center shadow-2xl"
      >
        <h1 className="text-3xl font-display font-bold mb-6 text-white">
          Cancel Reservation
        </h1>

        {status === 'idle' && (
          <>
            <p className="text-white/60 mb-10 leading-relaxed font-light italic">
              Are you sure you want to cancel your table reservation? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-4">
              <Button
                variant="destructive"
                className="w-full py-6 rounded-2xl font-bold uppercase tracking-widest"
                onClick={handleCancel}
              >
                Confirm Cancellation
              </Button>
              <Button
                variant="secondary"
                className="w-full py-6 rounded-2xl font-bold uppercase tracking-widest"
                onClick={() => router.push('/')}
              >
                Keep Reservation
              </Button>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center py-10">
            <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white/60 italic">Processing cancellation...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-10">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-xl mb-10 leading-relaxed">
              {message}
            </p>
            <Button
              variant="secondary"
              className="w-full py-6 rounded-2xl font-bold uppercase tracking-widest"
              onClick={() => router.push('/')}
            >
              Return to Home
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-10">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-lg mb-10 leading-relaxed font-bold">
              {message}
            </p>
            <Button
              variant="secondary"
              className="w-full py-6 rounded-2xl font-bold uppercase tracking-widest"
              onClick={() => router.push('/')}
            >
              Return to Home
            </Button>
          </div>
        )}
      </motion.div>
    </main>
  );
}
