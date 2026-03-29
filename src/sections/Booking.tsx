'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStores } from '@/hooks/use-odoo';
import { odoo } from '@/lib/odoo';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
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
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const initialTab = searchParams.get('tab') === 'party' ? 'party' : 'table';
  const [activeTab, setActiveTab] = useState<'table' | 'party'>(initialTab);

  const { data: stores, loading: storesLoading } = useStores();
  const [bookingConfig, setBookingConfig] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [formData, setFormData] = useState({
    branch: '',
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    guests: '2',
    instructions: '',
    eventType: 'Birthday',
    budget: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Set default branch if available
  useEffect(() => {
    if (stores.length > 0 && !formData.branch) {
      setFormData(prev => ({ ...prev, branch: stores[0].id }));
    }
  }, [stores, formData.branch]);

  // Pre-fill user data when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone || ''
      }));
    }
  }, [isAuthenticated, user]);

  // 2. Fetch Booking Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res: any = await odoo.getBookingConfig();
        if (res.status === 'success') {
          setBookingConfig(res.config);
          setError(null);
        } else {
          setError(res.message || 'Booking is currently unavailable at this location.');
          setBookingConfig(null);
        }
      } catch (err) {
        console.error('Failed to fetch booking config:', err);
        setError('Failed to connect to booking system.');
      }
    };
    if (formData.branch) fetchConfig();
  }, [formData.branch]);

  // 3. Fetch Available Slots
  useEffect(() => {
    const fetchSlots = async () => {
      if (!formData.date || !formData.branch || !bookingConfig) return;
      
      setIsLoadingSlots(true);
      setError(null);
      try {
        const res: any = await odoo.getBookingSlots(formData.date, parseInt(formData.guests), bookingConfig.id);
        if (res.status === 'success') {
          // Filter out past slots if today is selected
          let slots = res.slots || [];
          const tzDate = new Date();
          const todayStr = `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;
          const isToday = formData.date === todayStr;
          
          if (isToday) {
            const now = tzDate;
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            
            slots = slots.filter((slot: any) => {
              const [sHour, sMin] = slot.time.split(':').map(Number);
              if (sHour > currentHour) return true;
              if (sHour === currentHour && sMin > currentMin + 15) return true; // 15 min buffer
              return false;
            });
          }
          
          setAvailableSlots(slots);
          setSelectedSlot(null);
        } else {
          setError(res.message);
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error('Failed to fetch slots:', err);
        setError('Failed to load available times');
      } finally {
        setIsLoadingSlots(false);
      }
    };

    const timer = setTimeout(fetchSlots, 500); // Debounce
    return () => clearTimeout(timer);
  }, [formData.date, formData.guests, formData.branch, bookingConfig]);

  const handleReturnHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selectedStore = stores.find(s => s.id === formData.branch) || (stores.length > 0 ? stores[0] : null);
  const tzDate = new Date();
  const today = `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot && activeTab === 'table') {
      setError('Please select a time slot');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        config_id: bookingConfig?.id,
        party_size: parseInt(formData.guests),
        customer: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          notes: activeTab === 'party' 
            ? `[PARTY: ${formData.eventType}] ${formData.instructions} (Budget: ${formData.budget})`
            : formData.instructions
        },
        slot: selectedSlot || {
          start_time: `${formData.date} ${formData.time}:00`,
          end_time: `${formData.date} ${formData.time}:00`, // Placeholder for party
          tables: []
        }
      };

      const res: any = await odoo.createTableBooking(payload);
      if (res.status === 'success') {
        toast.success(t('successTitle'));
        setTimeout(() => {
          router.push('/dashboard?tab=bookings');
        }, 1500);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
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
            {bookingConfig && (
              <Card className="max-w-md mt-8 border-white/5 bg-neutral-900/50 backdrop-blur-xl rounded-[2.5rem]">
                <CardHeader className="pb-2">
                  <Label className="text-accent-gold uppercase tracking-widest text-[10px] font-black">{t('hoursTitle')}</Label>
                </CardHeader>
                <CardContent className="space-y-1">
                  {bookingConfig.periods?.map((period: any, idx: number) => {
                    const formatTime = (f: number) => {
                      const h = Math.floor(f);
                      const m = Math.round((f - h) * 60);
                      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    };
                    return (
                      <div key={idx} className="flex justify-between py-3 border-b border-white/5 last:border-0">
                        <span className="text-white/40 text-xs font-medium">{period.name}</span>
                        <span className="text-accent-gold font-bold text-sm tracking-tight">{formatTime(period.open)} - {formatTime(period.close)}</span>
                      </div>
                    );
                  })}
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

            {isAuthenticated ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {error}
                  </div>
                )}
                
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
                    max={bookingConfig?.max_party_size || "20"}
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
                {activeTab === 'party' && (
                  <div className="space-y-2">
                    <Label>{t('timeLabel')}</Label>
                    <Input type="time" name="time" value={formData.time} onChange={handleChange} required />
                  </div>
                )}
              </div>

              {/* Slot Selection for Table Booking */}
              {activeTab === 'table' && formData.date && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <Label>{t('availableSlots') || 'Select Time'}</Label>
                  {isLoadingSlots ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm">
                      <div className="w-4 h-4 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                      Checking availability...
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 text-xs rounded-lg border transition-all ${
                            selectedSlot?.time === slot.time
                              ? 'bg-accent-gold border-accent-gold text-primary font-bold tray-shadow'
                              : 'bg-white/5 border-white/10 text-white/60 hover:border-accent-gold/50'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm italic">
                      {formData.date ? 'No tables available for this date/party size.' : 'Select a date first.'}
                    </p>
                  )}
                </div>
              )}

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
                    disabled={isLoading || storesLoading || (activeTab === 'table' && !selectedSlot)}
                  >
                    {isLoading ? t('processing') : activeTab === 'table' ? t('submitTable') : t('submitParty')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-accent-gold/20">
                  <ShieldCheck className="w-10 h-10 text-accent-gold" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-4 italic">
                  {t('loginRequired')}
                </h2>
                <p className="text-white/60 mb-10 max-w-sm mx-auto leading-relaxed">
                  {t('loginRequiredDesc')}
                </p>
                
                <div className="flex flex-col gap-4">
                  <Button asChild className="w-full py-6 rounded-2xl bg-accent-gold text-primary font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-accent-gold/20">
                    <Link href="/auth?callbackUrl=/booking">
                      <LogIn className="w-5 h-5 mr-2" />
                      {t('signIn')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full py-6 rounded-2xl border-white/10 text-white hover:bg-white/5 uppercase tracking-widest text-xs font-bold">
                    <Link href="/auth?mode=signup&callbackUrl=/booking">
                      <UserPlus className="w-5 h-5 mr-2" />
                      {t('createAccount')}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

