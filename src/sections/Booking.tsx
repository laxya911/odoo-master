'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useStores } from '@/hooks/use-odoo';
import { odoo } from '@/lib/odoo';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BookingProps {
  onNavigateHome?: () => void;
}

export const Booking: React.FC<BookingProps> = ({ onNavigateHome }) => {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'party' ? 'party' : 'table';
  const [activeTab, setActiveTab] = useState<'table' | 'party'>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'party' || tab === 'table') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleReturnHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const { data: stores, loading: storesLoading } = useStores();

  const [formData, setFormData] = useState({
    branch: '',
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    guests: '2',
    instructions: '',
    eventType: 'Birthday', // For Party Booking
    budget: '' // For Party Booking
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedStore = stores.find(s => s.id === formData.branch) || stores[0];
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (activeTab === 'table') {
        await odoo.createReservation(formData);
      } else {
        // Assume odoo client has a createPartyBooking method or handle differently
        // For now, let's use the same reservation method with eventType in instructions if needed
        await odoo.createReservation({
          ...formData,
          instructions: `[PARTY: ${formData.eventType}] ${formData.instructions} (Budget: ${formData.budget})`
        });
      }
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isSubmitted) {
    return (
      <div className=" min-h-screen flex items-center justify-center bg-neutral-950 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-12 glass rounded-[40px] border border-accent-gold/20 max-w-lg shadow-2xl"
        >
          <div className="w-20 h-20 bg-accent-gold rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-accent-gold/20">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-display font-bold mb-4 text-white">
            {activeTab === 'table' ? 'Table Reserved' : 'Party Inquiry Sent'}
          </h2>
          <p className="text-white/60 mb-10 font-light italic leading-relaxed">
            Namaste! Your {activeTab === 'table' ? 'reservation' : 'party inquiry'} at {selectedStore?.name || 'our branch'} has been synchronized with our Odoo system. We look forward to serving you.
          </p>
          <Button
            variant="secondary"
            className="w-full sm:w-auto px-12"
            onClick={handleReturnHome}
          >
            Return to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-26 pb-24 bg-neutral-950 ">
      <div className="container mx-auto px-2 md:px-12">
        <div className="w-full grid lg:grid-cols-2 gap-10">
          <div>
            <header className="mb-12">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-8 h-px bg-accent-gold" />
                <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm font-bold">Reservations</h3>
              </div>
              <h1 className="text-5xl md:text-6xl font-display font-bold mb-8 text-white">
                {activeTab === 'table' ? 'Join Us' : 'Host a Party'}
              </h1>
              <p className="text-white/70 text-lg italic leading-relaxed max-w-md">
                {activeTab === 'table'
                  ? 'Experience premium Himalayan dining. Our table management is powered by seamless real-time synchronization.'
                  : 'Celebrate your special moments with us. From birthdays to anniversaries, we craft unforgettable experiences for your groups.'}
              </p>
            </header>
            {selectedStore && (
              <Card className="max-w-md">
                <CardHeader><Label>Operational Hours</Label></CardHeader>
                <CardContent>
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <span className="text-white/40 text-sm">Lunch Service</span>
                    <span className="text-accent-gold font-bold">{selectedStore?.hours.lunch}</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-white/40 text-sm">Dinner Service</span>
                    <span className="text-accent-gold font-bold">{selectedStore?.hours.dinner}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="glass p-4 md:p-12 rounded-[40px] border border-white/10 shadow-2xl">
            {/* Tab Switcher */}
            <div className="flex gap-4 mb-10 bg-white/5 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => setActiveTab('table')}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'table' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/70 hover:text-white/90 cursor-pointer'}`}
              >
                Table Reservation
              </button>
              <button
                onClick={() => setActiveTab('party')}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'party' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/70 hover:text-white/90 cursor-pointer'}`}
              >
                Book a Party
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="booking-branch">Branch Selection</Label>
                  <select
                    id="booking-branch"
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    required
                    aria-label="Select restaurant branch location"
                    className="w-full input-dark appearance-none bg-neutral-900/50 border-white/10"
                  >
                    <option value="" disabled className="bg-neutral-900">Choose a location</option>
                    {stores.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{activeTab === 'table' ? 'Number of Guests' : 'Approx. Guests'}</Label>
                  <Input
                    type="number"
                    name="guests"
                    min={activeTab === 'table' ? "1" : "10"}
                    max="100"
                    value={formData.guests}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {activeTab === 'party' && (
                <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="booking-event-type">Event Type</Label>
                    <select
                      id="booking-event-type"
                      name="eventType"
                      value={formData.eventType}
                      onChange={handleChange}
                      aria-label="Select type of event for party booking"
                      className="w-full input-dark appearance-none bg-neutral-900/50 border-white/10"
                    >
                      <option value="Birthday" className="bg-neutral-900">Birthday</option>
                      <option value="Anniversary" className="bg-neutral-900">Anniversary</option>
                      <option value="Corporate" className="bg-neutral-900">Corporate Event</option>
                      <option value="Family" className="bg-neutral-900">Family Gathering</option>
                      <option value="Other" className="bg-neutral-900">Other Special Occasion</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Budget</Label>
                    <Input
                      placeholder="e.g. 3000/person"
                      name="budget"
                      value={formData.budget}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>Preferred Date</Label>
                  <Input type="date" name="date" min={today} value={formData.date} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Time</Label>
                  <Input type="time" name="time" value={formData.time} onChange={handleChange} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required name="name" placeholder="Enter your full name" value={formData.name} onChange={handleChange} />
              </div>

              <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input required type="email" name="email" placeholder="email@example.com" value={formData.email} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input required type="tel" name="phone" placeholder="0x0-xxxx-xxxx" value={formData.phone} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-instructions">{activeTab === 'table' ? 'Special Instructions' : 'Event Details & Special Requests'}</Label>
                <textarea
                  id="booking-instructions"
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  placeholder={activeTab === 'table' ? "Allergies, seating preference, etc." : "Tell us more about your event..."}
                  aria-label={activeTab === 'table' ? 'Special instructions for your reservation' : 'Event details and special requests for your party'}
                  className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-accent-gold transition-colors min-h-[100px]"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full py-6 rounded-2xl bg-accent-gold  font-bold tracking-widest uppercase hover:scale-105 transition-transform shadow-xl shadow-accent-gold/20"
                  disabled={isLoading || storesLoading}
                >
                  {isLoading ? 'Processing Request...' : activeTab === 'table' ? 'Confirm Table Reservation' : 'Send Party Inquiry'}
                </Button>
                {/* <p className="text-center text-[10px] text-white/20 mt-4 uppercase tracking-[0.2em]">
                  Instant sync with Odoo POS System
                </p> */}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
