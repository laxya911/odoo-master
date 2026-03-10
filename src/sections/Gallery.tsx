'use client';

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { GALLERY } from '@/lib/data';
import { ImageLightbox } from '@/components/gallery/ImageLightbox';
import { useTranslations } from 'next-intl';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';
import { Badge } from '@/components/ui/badge';
const CATEGORIES = ['All', 'Food', 'Interior', 'Exterior'] as const;

export const Gallery: React.FC = () => {
  const t = useTranslations('gallery');
  const { translate } = useDynamicTranslation();
  const [activeFilter, setActiveFilter] = useState<(typeof CATEGORIES)[number]>('All');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const filteredImages = activeFilter === 'All'
    ? GALLERY
    : GALLERY.filter(img => img.category === activeFilter);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <section id="gallery" className="py-32 bg-neutral-950">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
          <div className="max-w-xl">
            <Badge variant="outline" className="text-accent-gold border-accent-gold/30 mb-4 px-4 py-1">
              {t('subtitle')}
            </Badge>
            <h2 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tight italic">
              {t('title')}
            </h2>
            <p className="text-white/60 mt-6 leading-relaxed text-lg italic">
              &quot;{t('desc')}&quot;
            </p>
          </div>

          <div className="flex flex-wrap gap-4 border-b border-white/5 pb-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`text-[10px] uppercase tracking-[0.3em] font-bold transition-all px-4 py-2 rounded-full ${activeFilter === cat
                  ? 'bg-accent-gold text-neutral-950'
                  : 'text-white/40 hover:text-white'
                  }`}
              >
                {t(`categories.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((img, index) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden bg-neutral-900 rounded-2xl cursor-pointer" onClick={() => openLightbox(index)}>
              <Image
                src={img.url}
                width={500}
                height={500}
                alt={translate(img.title)}
                className="absolute inset-0 w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000 opacity-60 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6 text-center">
                <div>
                  <p className="text-accent-gold text-[10px] font-bold uppercase tracking-widest mb-2">
                    {t(`categories.${img.category}`)}
                  </p>
                  <h4 className="text-white font-display text-lg">
                    {translate(img.title)}
                  </h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {lightboxOpen && (
          <ImageLightbox
            images={filteredImages.map(img => ({
              id: img.id,
              url: img.url,
              title: translate(img.title),
              category: img.category
            }))}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};
