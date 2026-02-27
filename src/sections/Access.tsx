'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { RAM_GROUP } from '../lib/data';

export const Access: React.FC = () => {
  const [selectedStoreId, setSelectedStoreId] = useState(RAM_GROUP.stores[0].id);
  const [copied, setCopied] = useState(false);
  const selectedStore = RAM_GROUP.stores.find(s => s.id === selectedStoreId)!;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(selectedStore.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedStore.address + ' ' + selectedStore.name)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="pt-26 pb-20 bg-neutral-950" id='stores'>
      <div className="container mx-auto px-10">
        <header className="mb-20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-8 h-px bg-accent-gold" />
            <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm font-bold">Find Your RAM</h3>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-bold">Stores & Access</h1>
        </header>

        {/* Store Selector */}
        <div className="flex flex-wrap gap-4 mb-16 border-b border-white/5 pb-8">
          {RAM_GROUP.stores.map((store) => (
            <button
              key={store.id}
              onClick={() => setSelectedStoreId(store.id)}
              className={`relative px-6 py-4 transition-all cursor-pointer ${selectedStoreId === store.id ? 'text-white' : 'text-white/70 hover:text-white/90'
                }`}
            >
              <span className="block text-sm font-bold uppercase tracking-widest">{store.name}</span>
              <span className="block text-[12px] text-white/70 font-jp">{store.nameJp}</span>
              {selectedStoreId === store.id && (
                <motion.div layoutId="storeUnderline" className="absolute bottom-0 left-0 w-full h-1 bg-accent-gold" />
              )}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStoreId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="space-y-12"
            >
              <div>
                <h2 className="text-3xl font-display font-bold mb-6 text-white">{selectedStore.name}</h2>
                <p className="text-xl text-white/60 mb-6 leading-relaxed">{selectedStore.address}</p>
                <div className="flex gap-4">
                  <button
                    onClick={handleCopyAddress}
                    className="px-6 py-3 bg-white/5 border border-white/10 text-white text-xs uppercase tracking-widest font-bold hover:bg-white/10 transition-colors rounded-full relative"
                  >
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                  <button
                    onClick={handleOpenMaps}
                    className="px-6 py-3 bg-accent-gold text-primary text-xs uppercase tracking-widest font-bold hover:bg-white transition-colors rounded-full"
                  >
                    Open Google Maps
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 pt-12 border-t border-white/5">
                <div className="space-y-6">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-accent-gold font-bold">Service Hours</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm font-light">Lunch</span>
                      <span className="font-bold text-white text-sm">{selectedStore.hours.lunch}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm font-light">Dinner</span>
                      <span className="font-bold text-white text-sm">{selectedStore.hours.dinner}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-accent-gold font-bold">Parking Support</h3>
                  <div className="space-y-2">
                    <p className="text-white/70 text-sm leading-relaxed">
                      {selectedStore.parkingInfo || "Street parking or nearby coin parking available."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-12 border-t border-white/5">
                <h3 className="text-xs uppercase tracking-[0.3em] text-accent-gold font-bold">Direct Contact</h3>
                <a
                  href={`tel:${selectedStore.phone.replace(/[^0-9]/g, '')}`}
                  className="block text-3xl font-display text-white tracking-tighter hover:text-accent-gold transition-colors"
                >
                  {selectedStore.phone}
                </a>
              </div>

              {selectedStore.note && (
                <div className="p-8 bg-accent-gold/5 border-l-4 border-accent-gold rounded-r-2xl">
                  <p className="text-white/70 text-sm leading-relaxed italic">
                    &quot;{selectedStore.note}&quot;
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="relative h-[600px] rounded-[40px] overflow-hidden bg-neutral-900 border border-white/10 group shadow-2xl">
            <Image
              src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1000"
              alt="Mito City view"
              fill
              className="w-full h-full object-cover opacity-20 grayscale group-hover:grayscale-0 transition-all duration-1000"
              priority
              fetchPriority="high"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-12 glass border border-white/10 rounded-[32px] max-w-sm shadow-2xl">
                <div className="w-16 h-16 bg-accent-gold rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
                  <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl mb-2">{selectedStore.name}</h3>
                <p className="text-xs text-white/70 mb-6 tracking-widest uppercase">{selectedStore.nameJp}</p>
                <div className="h-px w-12 bg-accent-gold/30 mx-auto mb-6" />
                <p className="text-xs text-white/70 mb-8 italic">Available for Dine-in and Takeaway</p>
                <button
                  onClick={handleOpenMaps}
                  className="text-[10px] tracking-widest uppercase font-bold text-accent-gold border border-accent-gold/40 px-8 py-3 rounded-full cursor-pointer hover:bg-accent-gold hover:text-primary transition-all"
                >
                  Get Directions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
