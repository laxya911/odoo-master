'use client'
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useProducts } from '@/context/ProductContext';
import { usePosSession } from '@/hooks/use-odoo';
import { useProductConfigurator } from '@/hooks/use-product-configurator';
import { ProductCard } from '@/components/menu/ProductCard';
import { Product } from '@/lib/types';
import { useTranslations } from 'next-intl';

const ProductConfigurator = dynamic(() => import('@/components/menu/ProductConfigurator').then(mod => ({ default: mod.ProductConfigurator })), {
    ssr: false,
});

interface SignatureDishProps {
    onNavigateMenu?: () => void;
}


export const SignatureDish: React.FC<SignatureDishProps> = ({ onNavigateMenu }) => {
    const t = useTranslations('signature');
    const { products, loading } = useProducts();
    const {
        selectedProduct,
        setSelectedProduct,
        isLoadingDetails,
        openConfigurator,
        isPosOpen
    } = useProductConfigurator();

    const handleExplore = () => {
        if (onNavigateMenu) {
            onNavigateMenu();
        } else {
            window.location.href = '/menu';
        }
    };


    // For now, take the first 4 as "Signature"
    // Later we can filter by a specific category named "Signature"
    const featured = products.slice(0, 4);

    return (
        <div className="relative">
            {/* Signature Dishes */}
            <section className="py-20 bg-neutral-900 border-y border-white/5">
                <div className="container mx-auto px-6 mb-16 flex justify-between items-end">
                    <div>
                        <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm mb-4">{t('subtitle')}</h3>
                        <h2 className="text-4xl md:text-5xl font-display font-bold">{t('title')}</h2>
                    </div>
                    <button
                        onClick={handleExplore}
                        className="hidden md:block text-accent-gold border-b border-accent-gold/30 hover:border-accent-gold transition-colors pb-1 text-sm uppercase tracking-widest"
                    >
                        {useTranslations('menu')('title')}
                    </button>
                </div>

                <div className="container mx-auto px-6">
                    {loading ? (
                        <div className="grid md:grid-cols-4 gap-10">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-80 rounded-[32px] bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-4 gap-10">
                            {featured.map((item, index) => (
                                <ProductCard
                                    key={item.id}
                                    product={item}
                                    index={index}
                                    isPosOpen={!!isPosOpen}
                                    onOpenConfigurator={openConfigurator}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Product Configurator Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-0 md:p-6">
                    <ProductConfigurator
                        product={selectedProduct}
                        onClose={() => setSelectedProduct(null)}
                        isLoadingDetails={isLoadingDetails}
                    />
                </div>
            )}
        </div>
    );
};
