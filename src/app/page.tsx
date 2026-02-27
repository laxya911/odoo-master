import React from 'react';
import { Home as HomeSection } from '@/sections/Home';
import { Access } from '@/sections/Access';
import { Booking } from '@/sections/Booking';
import { SignatureDish } from '@/sections/SignatureDish';
import { CTA } from '@/sections/CTA';

export default function Page() {
  return (
    <main role='main' className="min-h-screen font-body flex flex-col selection:bg-accent-gold selection:text-primary ">
      <div className="flex-grow" >
        <section id="home">
          <HomeSection />
        </section>
        <section id="signature">
          <SignatureDish />
        </section>

        <section id="access">
          <Access />
        </section>

        <section id="cta">
          <CTA />
        </section>

        <section id="booking">
          <React.Suspense fallback={<div className="h-[400px] flex items-center justify-center bg-neutral-950"><div className="w-8 h-8 border-4 border-accent-gold border-t-transparent rounded-full animate-spin" /></div>}>
            <Booking />
          </React.Suspense>
        </section>
      </div>
    </main>
  );
}
