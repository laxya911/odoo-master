'use client'
import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useProducts } from '@/context/ProductContext';
import { usePosSession } from '@/hooks/use-odoo';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/lib/types';
import { MenuHero } from '@/components/menu/MenuHero';
import { ProductCard } from '@/components/menu/ProductCard';

// Dynamic import for ProductConfigurator to reduce initial bundle
const ProductConfigurator = dynamic(() => import('@/components/menu/ProductConfigurator').then(mod => ({ default: mod.ProductConfigurator })), {
  ssr: false,
});

export const Menu: React.FC = () => {
  const { products: menuItems, tags, categories: posCategories, loading } = useProducts();
  const { isOpen: isPosOpen, loading: sessionLoading } = usePosSession();

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['All']));
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(['All']));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const categories = useMemo(() => {
    return ['All', ...posCategories.map(c => c.name)];
  }, [posCategories]);

  const tagList = useMemo(() => {
    const uniqueTags = new Set<string>();
    menuItems.forEach(item => {
      item.product_tag_ids?.forEach((tagId: number) => {
        const tagName = tags[tagId]?.name;
        if (tagName) uniqueTags.add(tagName);
      });
    });
    return ['All', ...Array.from(uniqueTags)];
  }, [menuItems, tags]);

  const toggleCategory = (cat: string) => {
    const newCats = new Set(selectedCategories);
    if (cat === 'All') {
      newCats.clear();
      newCats.add('All');
    } else {
      newCats.delete('All');
      if (newCats.has(cat)) {
        newCats.delete(cat);
        if (newCats.size === 0) newCats.add('All');
      } else {
        newCats.add(cat);
      }
    }
    setSelectedCategories(newCats);
  };

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags);
    if (tag === 'All') {
      newTags.clear();
      newTags.add('All');
    } else {
      newTags.delete('All');
      if (newTags.has(tag)) {
        newTags.delete(tag);
        if (newTags.size === 0) newTags.add('All');
      } else {
        newTags.add(tag);
      }
    }
    setSelectedTags(newTags);
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const categoryMatch = selectedCategories.has('All') ||
        item.pos_categ_ids?.some(catId => {
          const cat = posCategories.find(c => c.id === catId);
          return cat && selectedCategories.has(cat.name);
        });

      const tagMatch = selectedTags.has('All') ||
        item.product_tag_ids?.some((tagId: number) => {
          const tagName = tags[tagId]?.name;
          return tagName && selectedTags.has(tagName);
        });

      return categoryMatch && tagMatch;
    });
  }, [selectedCategories, selectedTags, menuItems, tags, posCategories]);

  const openConfigurator = useCallback(async (product: Product) => {
    if (!isPosOpen) return;
    setIsLoadingDetails(true);
    setSelectedProduct(product); // Open modal immediately with basic info
    try {
      const res = await fetch(`/api/odoo/restaurant/product-details?id=${product.id}`);
      if (res.ok) {
        const details = await res.json();
        // Merge: keep original product fields, add attributes and combo_lines from details
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

  return (
    <section className="pt-16 pb-24 bg-neutral-950 relative" id="menu">
      <MenuHero />
      <div className="container mx-auto px-6">
        <header className="max-w-4xl mb-8">
          <Badge variant="outline" className="mb-2">Digital Concierge</Badge>
          <div className="flex flex-col md:flex-row md:items-end gap-6 mb-6">
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-white flex-grow">Experience RAM Menu</h1>
            {!sessionLoading && !isPosOpen && (
              <div className="bg-accent-chili/10 border border-accent-chili/30 px-6 py-3 rounded-2xl">
                <p className="text-accent-chili text-xs font-bold uppercase tracking-widest">Kitchen Closed • Ordering Unavailable</p>
              </div>
            )}
          </div>
        </header>

        {/* Category Filter */}
        <div className="flex flex-col gap-6 mb-12">
          <div>
            <h3 className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em] mb-4 ml-1">Categories</h3>
            <div className="flex flex-wrap gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`whitespace-nowrap px-6 md:px-8 py-3 rounded-full text-[10px] tracking-widest uppercase transition-all border ${selectedCategories.has(cat)
                    ? 'bg-accent-gold border-accent-gold text-primary font-bold shadow-lg shadow-accent-gold/20'
                    : 'bg-white/5 border-white/5 text-white/90 hover:text-white cursor-pointer'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {tagList.length > 1 && (
            <div>
              <h3 className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em] mb-4 ml-1">Special Diets & Tags</h3>
              <div className="flex flex-wrap gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar">
                {tagList.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`whitespace-nowrap px-5 py-2 rounded-full text-[9px] tracking-widest uppercase transition-all border ${selectedTags.has(tag)
                      ? 'bg-white text-primary border-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white cursor-pointer'
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-80 rounded-[32px] bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredItems.map((item, index) => (
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
    </section>
  );
};
