'use client'
import React from 'react';
import { RAM_GROUP } from '@/lib/data';
import { MapPin, Phone, Clock, Navigation, Info, Copy, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';

export const Access: React.FC = () => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const t = useTranslations('access');
  const { translate } = useDynamicTranslation();

  const copyAddress = (address: string, id: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section id="stores" className="py-32 bg-neutral-950 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <Badge variant="outline" className="text-accent-gold border-accent-gold/30 mb-4 px-4 py-1">
              {t('findYourRam')}
            </Badge>
            <h2 className="text-5xl md:text-6xl font-display font-bold text-white tracking-tight italic">
              {t('title')}
            </h2>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {RAM_GROUP.stores.map((store) => (
            <Card key={store.id} className="bg-white/5 border-white/10 hover:border-accent-gold/30 transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2">
                  <div className="p-8 space-y-8">
                    <div>
                      <h3 className="text-2xl font-display font-medium text-white mb-2 group-hover:text-accent-gold transition-colors">
                        {translate(store.name)}
                      </h3>
                      <div className="flex items-start gap-3 mt-4">
                        <MapPin className="w-5 h-5 text-accent-gold shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/80 leading-relaxed text-sm">
                            {translate(store.address)}
                          </p>
                          <button
                            onClick={() => copyAddress(store.address, store.id)}
                            className="flex items-center gap-2 text-xs text-accent-gold/70 hover:text-accent-gold mt-3 font-medium transition-colors"
                          >
                            {copiedId === store.id ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('copied')}
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                {t('copyAddress')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-accent-gold">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">{t('serviceHours')}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/40">{t('lunch')}</span>
                            <span className="text-white/80 font-medium">{store.hours.lunch}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/40">{t('dinner')}</span>
                            <span className="text-white/80 font-medium">{store.hours.dinner}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-accent-gold">
                          <Phone className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">{t('directContact')}</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium">{store.phone}</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-4 h-4 text-accent-gold shrink-0 mt-1" />
                        <div className="space-y-2">
                          <p className="text-white/60 text-xs leading-relaxed italic">
                            {translate(store.note)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-white/5 text-white/40 border-none text-[10px] py-0 h-5">
                              {t('availableInfo')}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          className="w-full bg-accent-gold text-neutral-900 border-none hover:bg-white transition-all font-bold text-xs h-11"
                          onClick={() => {
                            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address + ' ' + store.name)}`
                            window.open(url, '_blank')
                          }}
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          {t('getDirections')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="relative h-full min-h-[300px] md:min-h-0 bg-neutral-900 overflow-hidden">
                    <div className="absolute inset-0 bg-accent-gold/20 mix-blend-overlay group-hover:opacity-0 transition-opacity z-10" />
                    <img
                      src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1000"
                      alt={translate(store.name)}
                      className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700 opacity-60"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-neutral-950 to-transparent z-20">
                      <div className="flex items-center gap-2 text-accent-gold mb-1">
                        <Info className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('parkingSupport')}</span>
                      </div>
                      <p className="text-white/80 text-sm font-medium leading-relaxed">
                        {translate(store.parkingInfo) || t('parkingDefault')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
