'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { GALLERY } from '../lib/data';
import { ImageLightbox } from '@/components/gallery/ImageLightbox';

export const Gallery: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'Food' | 'Interior' | 'Exterior'>('All');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const filteredImages = filter === 'All'
    ? GALLERY
    : GALLERY.filter(img => img.category === filter);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className='pt-26 pb-24 bg-neutral-950'>
      <div className="container mx-auto px-6">
        <header className="mb-16">
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-6">Atmosphere</h1>
          <div className="flex flex-wrap gap-4">
            {['All', 'Food', 'Interior', 'Exterior'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat as 'All' | 'Food' | 'Interior' | 'Exterior')}
                className={`px-6 py-2 rounded-full text-[12px] tracking-widest uppercase transition-all ${filter === cat ? 'bg-accent-gold text-primary' : 'bg-white/10 text-white/70 hover:text-white/90 cursor-pointer'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredImages.map((img, index) => (
              <motion.div
                layout
                key={img.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-[4/5] overflow-hidden rounded-3xl cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={img.url}
                  alt={img.title}
                  fill
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  priority={index < 4}
                  fetchPriority={index < 4 ? "high" : undefined}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8">
                  <span className="text-accent-gold text-[10px] uppercase tracking-widest mb-2">{img.category}</span>
                  <h3 className="text-xl font-display font-bold text-white">{img.title}</h3>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <ImageLightbox
            images={filteredImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
