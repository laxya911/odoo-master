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
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BookingProps {
  onNavigateHome?: () => void;
}

const EVENT_TYPES = ['Birthday', 'Anniversary', 'Corporate', 'Family', 'Other'] as const;

export const Booking: React.FC<BookingProps> = ({ onNavigateHome }) => {
  const t = useTranslations('booking');
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

  const selectedStore = stores.find(s => s.id === formData.branch) || (stores.length > 0 ? stores[0] : null);
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (activeTab === 'table') {
        await odoo.createReservation(formData);
      } else {
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
            {activeTab === 'table' ? t('successTitle') : t('partySuccessTitle')}
          </h2>
          <p className="text-white/60 mb-10 font-light italic leading-relaxed">
            {t('successMessage', {
              type: activeTab === 'table' ? t('reservation') : t('partyInquiry'),
              branch: selectedStore?.name || 'our branch'
            })}
          </p>
          <Button
            variant="secondary"
            className="w-full sm:w-auto px-12"
            onClick={handleReturnHome}
          >
            {t('returnHome')}
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
                <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm font-bold">{t('title')}</h3>
              </div>
              <h1 className="text-5xl md:text-6xl font-display font-bold mb-8 text-white">
                {activeTab === 'table' ? t('subtitle') : t('partySubtitle')}
              </h1>
              <p className="text-white/70 text-lg italic leading-relaxed max-w-md">
                {activeTab === 'table' ? t('desc') : t('partyDesc')}
              </p>
            </header>
            {selectedStore && (
              <Card className="max-w-md">
                <CardHeader><Label>{t('hoursTitle')}</Label></CardHeader>
                <CardContent>
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <span className="text-white/40 text-sm">{t('lunch')}</span>
                    <span className="text-accent-gold font-bold">{selectedStore?.hours.lunch}</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-white/40 text-sm">{t('dinner')}</span>
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
                type="button"
                onClick={() => setActiveTab('table')}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'table' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/70 hover:text-white/90 cursor-pointer'}`}
              >
                {t('tableTab')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('party')}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'party' ? 'bg-accent-gold text-primary shadow-lg' : 'text-white/70 hover:text-white/90 cursor-pointer'}`}
              >
                {t('partyTab')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="booking-branch">{t('branchLabel')}</Label>
                  <select
                    id="booking-branch"
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    required
                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-accent-gold"
                  >
                    <option value="" disabled className="bg-neutral-900">{t('branchPlaceholder')}</option>
                    {stores.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{activeTab === 'table' ? t('guestsLabel') : t('partyGuestsLabel')}</Label>
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
                    <Label htmlFor="booking-event-type">{t('eventTypeLabel')}</Label>
                    <Select
                      value={formData.eventType}
                      onValueChange={(value) => setFormData({ ...formData, eventType: value })}
                    >
                      <SelectTrigger
                        id="booking-event-type"
                        className="w-full bg-neutral-900/50 border-white/10"
                      >
                        <SelectValue placeholder={t('eventTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-white/10 text-white">
                        {EVENT_TYPES.map(type => (
                          <SelectItem key={type} value={type}>
                            {t(`eventTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('budgetLabel')}</Label>
                    <Input
                      placeholder={t('budgetPlaceholder')}
                      name="budget"
                      value={formData.budget}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>{t('dateLabel')}</Label>
                  <Input type="date" name="date" min={today} value={formData.date} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('timeLabel')}</Label>
                  <Input type="time" name="time" value={formData.time} onChange={handleChange} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('nameLabel')}</Label>
                <Input required name="name" placeholder={t('namePlaceholder')} value={formData.name} onChange={handleChange} />
              </div>

              <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>{t('emailLabel')}</Label>
                  <Input required type="email" name="email" placeholder="email@example.com" value={formData.email} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>{t('phoneLabel')}</Label>
                  <Input required type="tel" name="phone" placeholder="0x0-xxxx-xxxx" value={formData.phone} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-instructions">{activeTab === 'table' ? t('instructionsLabel') : t('partyInstructionsLabel')}</Label>
                <textarea
                  id="booking-instructions"
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  placeholder={activeTab === 'table' ? t('instructionsPlaceholder') : t('partyInstructionsPlaceholder')}
                  className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-accent-gold transition-colors min-h-[100px]"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full py-6 rounded-2xl bg-accent-gold  font-bold tracking-widest uppercase hover:scale-105 transition-transform shadow-xl shadow-accent-gold/20"
                  disabled={isLoading || storesLoading}
                >
                  {isLoading ? t('processing') : activeTab === 'table' ? t('submitTable') : t('submitParty')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

