'use client'
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useProducts } from '@/context/ProductContext';
import { usePosSession } from '@/hooks/use-odoo';
import { ProductCard } from '@/components/menu/ProductCard';
import { Product } from '@/lib/types';

const ProductConfigurator = dynamic(() => import('@/components/menu/ProductConfigurator').then(mod => ({ default: mod.ProductConfigurator })), {
    ssr: false,
});

interface SignatureDishProps {
    onNavigateMenu?: () => void;
}


export const SignatureDish: React.FC<SignatureDishProps> = ({ onNavigateMenu }) => {
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

    // For now, take the first 4 as "Signature"
    // Later we can filter by a specific category named "Signature"
    const featured = products.slice(0, 4);

    return (
        <div className="relative">
            {/* Signature Dishes */}
            <section className="py-20 bg-neutral-900 border-y border-white/5">
                <div className="container mx-auto px-6 mb-16 flex justify-between items-end">
                    <div>
                        <h3 className="text-accent-gold uppercase tracking-[0.3em] text-sm mb-4">Lunch Favorites</h3>
                        <h2 className="text-4xl md:text-5xl font-display font-bold">Chef&apos;s Recommendations</h2>
                    </div>
                    <button
                        onClick={handleExplore}
                        className="hidden md:block text-accent-gold border-b border-accent-gold/30 hover:border-accent-gold transition-colors pb-1 text-sm uppercase tracking-widest"
                    >
                        See Full Menu
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
