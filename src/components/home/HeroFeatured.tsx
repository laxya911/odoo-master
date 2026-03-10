'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/lib/types';
import { generateSlug } from '@/lib/utils';

import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useTranslations } from 'next-intl';

interface HeroFeaturedProps {
  featured: Product[];
  onOpenConfigurator?: (product: Product) => void;
}

export const HeroFeatured: React.FC<HeroFeaturedProps> = ({ featured, onOpenConfigurator }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { formatPrice } = useCompany();
  const t = useTranslations('home');

  // Swipe handlers
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const prevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + featured.length) % featured.length);
  };

  const nextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % featured.length);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left - next
      nextSlide();
    }
    if (touchStart - touchEnd < -75) {
      // Swipe right - previous
      prevSlide();
    }
  };

  useEffect(() => {
    if (featured.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featured.length]);

  if (featured.length === 0) return null;

  const currentProduct = featured[currentIndex];
  const imageUrl = currentProduct.image_256 ? `data:image/png;base64,${currentProduct.image_256}` : '/images/placeholder-food.jpg';

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent opening if it was a swipe (more than 10px move)
    if (Math.abs(touchStart - touchEnd) > 10 && touchEnd !== 0) {
      return;
    }
    if (onOpenConfigurator) {
      onOpenConfigurator(currentProduct);
    }
  };

  return (
    <div className="relative w-full h-[275px] md:h-[350px] lg:h-[450px] max-w-xl mx-auto lg:ml-auto group">
      {/* Decorative background element */}
      <div className="absolute -top-5 -right-10 w-full h-full border border-accent-gold/20 rounded-[40px] transition-transform duration-700 group-hover:translate-x-4 group-hover:-translate-y-4" />
      <div className="absolute -bottom-5 -left-10 w-full h-full border border-accent-gold/10 rounded-[40px] transition-transform duration-700 group-hover:-translate-x-4 group-hover:translate-y-4" />

      {/* Main Card */}
      <div
        className="relative w-full h-full rounded-[40px] overflow-hidden shadow-2xl cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={imageUrl}
              alt={currentProduct.name}
              fill
              className="object-cover opacity-60 transition-transform duration-700 hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 500px"
              priority={currentIndex === 0}
              quality={60}
            />

            {/* Content Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent p-8 md:p-12 flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-px bg-accent-gold" />
                    <span className="text-accent-gold text-[10px] uppercase tracking-[0.3em] font-bold">
                      {t('featuredDish')}
                    </span>
                  </div>
                  <Link
                    href={`/menu/${generateSlug(currentProduct.name)}`}
                    className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest hover:text-accent-gold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('viewDetails')} <ChevronRight size={12} />
                  </Link>
                </div>

                <h3 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
                  {currentProduct.name}
                </h3>

                {currentProduct.description_sale && (
                  <p className="text-white/60 text-sm md:text-base italic leading-relaxed line-clamp-2 max-w-md">
                    {currentProduct.description_sale}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-accent-gold font-bold text-2xl">
                    {formatPrice(currentProduct.list_price)}
                  </span>

                  <div className="flex gap-2">
                    {featured.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCurrentIndex(idx);
                        }}
                        aria-label={`View ${item.name}`}
                        className="group/dot p-2 -m-2" /* Increased hit area */
                      >
                        <div className={`w-8 h-1 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-accent-gold w-12' : 'bg-white/20 group-hover/dot:bg-white/40'
                          }`} />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Side Arrows - Only visible on desktop hover or mobile taps */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={prevSlide}
            className="w-10 h-10 rounded-full bg-neutral-900/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-accent-gold hover:text-primary transition-all shadow-xl"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full bg-neutral-900/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-accent-gold hover:text-primary transition-all shadow-xl"
            aria-label="Next Slide"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
