import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { Booking } from '@/sections/Booking';

export const metadata: Metadata = {
  title: 'Reservations & Party Booking',
  description: 'Join us for an authentic dining experience. Book a table or host your special party with our tailored courses.',
};

export default function BookingPage() {
  return (
    <main role="main" className="mt-10 bg-neutral-950 ">
      <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-accent-gold border-t-transparent rounded-full animate-spin" /></div>}>
        <Booking />
      </Suspense>
    </main>
  );
}