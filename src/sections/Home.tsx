'use client'
import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { RAM_GROUP } from '../lib/data';
import { Product } from '@/lib/types';
import { usePosSession } from '@/hooks/use-odoo';
import { useProducts } from '@/context/ProductContext';
import dynamic from 'next/dynamic';

const ProductConfigurator = dynamic(() => import('@/components/menu/ProductConfigurator').then(mod => ({ default: mod.ProductConfigurator })), {
  ssr: false,
});

interface HomeProps {
  onNavigateMenu?: () => void;
}

import { HeroFeatured } from '@/components/home/HeroFeatured';

export const Home: React.FC<HomeProps> = ({ onNavigateMenu }) => {
  const { products, loading } = useProducts();
  const { isOpen: isPosOpen } = usePosSession();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleExplore = () => {
    if (onNavigateMenu) {
      onNavigateMenu();
    } else {
      window.location.href = '/menu';
    }
  };

  const openConfigurator = useCallback(async (product: Product) => {
    if (!isPosOpen) return;
    setIsLoadingDetails(true);
    setSelectedProduct(product); // Open modal immediately with basic info
    try {
      const res = await fetch(`/api/odoo/restaurant/product-details?id=${product.id}`);
      if (res.ok) {
        const details = await res.json();
        setSelectedProduct(prev => prev ? {
          ...prev,
          attributes: details.attributes || [],
          combo_lines: details.combo_lines || [],
        } : null);
      }
    } catch (e) {
      console.error('Failed to fetch product details:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [isPosOpen]);

  // Featured products for the hero slider - slice 5 for variety
  const featured = products.slice(0, 5);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[100vh] lg:h-screen flex items-center overflow-hidden pt-32 lg:pt-0">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0 text-[Image]">
          <Image
            src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=2000"
            alt="RAM Restaurant Atmosphere"
            fill
            className="object-cover scale-110 blur-sm opacity-20"
            priority
            fetchPriority="high"
            sizes="100vw"
            quality={50}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-accent-gold font-body tracking-[0.4em] uppercase text-sm md:text-base mt-10">
                Established {RAM_GROUP.established} in Ibaraki
              </h2>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 leading-tight">
                RAM <span className="italic font-light text-white/90">Dining</span> <br />
                Authentic Heritage
              </h1>
              <p className="text-lg md:text-xl text-white/60 mb-12 max-w-2xl font-light leading-relaxed">
                {RAM_GROUP.tagline} {RAM_GROUP.taglineJp} Experience the finest curries and Himalayan hospitality across our four locations.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 mb-12 lg:mb-0">
                <button
                  onClick={handleExplore}
                  className="px-10 py-5 bg-accent-gold text-primary font-bold rounded-full tracking-widest uppercase hover:scale-105 transition-transform shadow-xl shadow-accent-gold/20"
                >
                  Explore Our Menu
                </button>
                <div className="flex flex-col justify-center">
                  <span className="text-accent-gold font-bold text-xl">Take Out 5% OFF</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Available at all locations</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              {!loading && <HeroFeatured featured={featured} onOpenConfigurator={openConfigurator} />}
              {loading && (
                <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] max-w-xl mx-auto lg:ml-auto bg-white/5 animate-pulse rounded-[40px]" />
              )}
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/30 flex flex-col items-center gap-2 hidden lg:flex"
        >
          <span className="text-[10px] uppercase tracking-widest  text-accent-gold">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-accent-gold to-transparent" />
        </motion.div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-neutral-950">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-64 h-64 bg-accent-gold/10 rounded-full blur-3xl" />
              <div className="relative z-10 w-full h-[400px]">
                <Image
                  src="https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=1000"
                  alt="Chef at RAM"
                  fill
                  className="rounded-2xl grayscale hover:grayscale-0 transition-all duration-1000 border border-white/5 object-cover"
                  quality={60}
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent-chili rounded-2xl flex items-center justify-center p-6 text-white text-center z-20 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-widest">Est. {RAM_GROUP.established} <br /> in Ibaraki </p>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm">A Legacy of Spice</h3>
              <h2 className="text-4xl md:text-5xl font-display font-bold leading-tight">
                Crafting Joy <br /> Since {RAM_GROUP.established}
              </h2>
              <p className="text-white/60 leading-relaxed text-lg italic">
                &quot;Our mission is simple: to bring the authentic, uncompromised heat and hospitality of India and Nepal to Ibaraki. Every spice is hand-selected, every naan hand-stretched.&quot;
              </p>
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-white/5">
                <div>
                  <h3 className="text-2xl font-display text-accent-gold mb-2"><a href="#stores">Four Stores</a></h3>
                  <p className="text-white/60 text-sm">Convenient locations across Mito and Hitachinaka.</p>
                </div>
                <div>
                  <h3 className="text-2xl font-display text-accent-gold mb-2">Authenticity</h3>
                  <p className="text-white/60 text-sm">Recipes straight from the Himalayas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Configurator Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-0 md:p-6">
            <ProductConfigurator
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              isLoadingDetails={isLoadingDetails}
            />
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
