'use client';

import { useState, useCallback } from 'react';
import { Product } from '@/lib/types';
import { useSession } from '@/context/SessionContext';

/**
 * Centralized hook to manage product configurator state and fetching.
 * Used by Menu, Home, and SignatureDish sections.
 */
export function useProductConfigurator() {
  const { session, isLoading: sessionLoading } = useSession();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const openConfigurator = useCallback(async (product: Product) => {
    if (!session.isOpen) return;

    // --- Optimization: Use pre-fetched details if available ---
    if (
      (product.attributes && product.attributes.length > 0) ||
      (product.combo_lines && product.combo_lines.length > 0)
    ) {
      setSelectedProduct(product);
      setIsLoadingDetails(false);
      return;
    }

    setIsLoadingDetails(true);
    setSelectedProduct(product); // Open modal immediately with basic info
    try {
      const res = await fetch(`/api/odoo/restaurant/product-details?id=${product.id}`);
      if (res.ok) {
        const details = await res.json();
        // Merge: keep original product fields, add attributes and combo_lines from details
        setSelectedProduct((prev) =>
          prev
            ? {
                ...prev,
                attributes: details.attributes || [],
                combo_lines: details.combo_lines || [],
                // Ensure image and other fields are preserved from prev
              }
            : null
        );
      }
    } catch (e) {
      console.error('Failed to fetch product details:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [session.isOpen]);

  const closeConfigurator = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  return {
    selectedProduct,
    setSelectedProduct,
    isLoadingDetails,
    openConfigurator,
    closeConfigurator,
    isPosOpen: session.isOpen,
    sessionLoading,
  };
}
