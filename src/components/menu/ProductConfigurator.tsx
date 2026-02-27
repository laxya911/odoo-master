'use client';
import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Product, ProductAttribute, ComboLine } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useCompany } from '@/context/CompanyContext';
import { useSession } from '@/context/SessionContext';

interface ProductConfiguratorProps {
  product: Product;
  onClose: () => void;
  isLoadingDetails?: boolean;
}

export const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({ product, onClose, isLoadingDetails = false }) => {
  const { addToCart } = useCart();
  const { formatPrice } = useCompany();
  const { session } = useSession();

  // Use attributes if available
  const attributes = useMemo(() => product.attributes || [], [product.attributes]);
  // Use combo_lines if available
  const comboLines = useMemo(() => product.combo_lines || [], [product.combo_lines]);

  const [configSelections, setConfigSelections] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    attributes.forEach((attr: ProductAttribute) => {
      // Odoo attribute structure: { id, name, type, values: [{id, name, price_extra}] }
      // Assuming type mapping: 'radio', 'select', etc. 
      // Odoo types: 'radio', 'select', 'color'
      // We default to first value for radio/select if required/available
      const display_type = (attr as unknown as ProductAttribute).display_type || 'radio';
      if (display_type === 'radio' || display_type === 'select') {
        if (attr.values && attr.values.length > 0) {
          initial[attr.id] = [attr.values[0].id];
        }
      } else {
        initial[attr.id] = [];
      }
    });
    return initial;
  });

  const [comboSelections, setComboSelections] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    comboLines.forEach((line: ComboLine) => {
      // For Combo lines (radio-like), default to first option if required
      if (line.required && line.product_ids.length > 0) {
        initial[line.id] = [line.product_ids[0]];
      } else {
        initial[line.id] = [];
      }
    });
    return initial;
  });

  const [configInstructions, setConfigInstructions] = useState('');

  const currentConfigPrice = useMemo(() => {
    let total = product.list_price;

    // Add attribute prices
    attributes.forEach((attr: ProductAttribute) => {
      const selectedIds = configSelections[attr.id] || [];
      attr.values.forEach((val: { id: number; name: string; price_extra?: number }) => {
        if (selectedIds.includes(val.id)) total += (val.price_extra || 0); // Odoo uses price_extra
      });
    });

    // Add combo prices
    comboLines.forEach((line: ComboLine) => {
      const selectedIds = comboSelections[line.id] || [];
      line.products?.forEach((p: Product) => {
        if (selectedIds.includes(p.id)) total += (p.list_price || 0);
      });
    });

    return total;
  }, [product, configSelections, comboSelections, attributes, comboLines]);

  const handleAddToCart = () => {
    const attribute_value_ids = Object.values(configSelections).flat();
    const combo_selections = Object.entries(comboSelections).map(([lineId, productIds]) => ({
      combo_line_id: parseInt(lineId),
      product_ids: productIds
    })).filter(c => c.product_ids.length > 0);

    const productWithPrice: Product = {
      ...product,
      list_price: currentConfigPrice
    };

    addToCart(productWithPrice, 1, {
      attribute_value_ids,
      combo_selections,
      notes: configInstructions.trim() || undefined
    });
    onClose();
  };

  return (
    <div
      className="bg-neutral-900 border-t md:border border-white/10 w-full max-w-4xl md:rounded-[40px] h-full md:h-[85vh] md:max-h-[900px] overflow-hidden shadow-2xl relative flex flex-col"
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white z-[110] backdrop-blur-md"
      >
        ✕
      </button>

      <div className="flex flex-col md:flex-row h-full overflow-hidden">
        <div className="h-40 md:h-auto md:w-2/5 shrink-0 relative overflow-hidden">
          <Image
            src={product.image_256 ? `data:image/png;base64,${product.image_256}` : '/images/placeholder-food.jpg'}
            fill
            className="object-cover"
            alt={product.name}
          />
        </div>
        <div className="flex-grow flex flex-col h-full overflow-hidden relative">
          <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar pb-12">
            <div>
              <Badge variant="secondary" className="mb-2 h-6">Configure Dish</Badge>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white text-balance">{product.name}</h2>
              {typeof product.details?.description_sale === 'string' && (
                <p className="text-white/70 text-sm italic mt-2 leading-relaxed">{product.details.description_sale}</p>
              )}
            </div>

            {/* Loading state while fetching attributes */}
            {isLoadingDetails && (
              <div className="flex items-center justify-center py-6 gap-3">
                <div className="w-5 h-5 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                <span className="text-white/50 text-sm">Loading options...</span>
              </div>
            )}

            {/* Attributes Section */}
            {!isLoadingDetails && attributes.map((attr: ProductAttribute) => (
              <div key={attr.id} className="space-y-4">
                <Label className="mb-0 text-white/70">{attr.name}</Label>
                <div className="flex flex-wrap gap-2">
                  {attr.values.map((val: { id: number; name: string; price_extra?: number }) => {
                    const isSelected = configSelections[attr.id]?.includes(val.id);
                    return (
                      <button
                        key={val.id}
                        onClick={() => {
                          setConfigSelections(prev => {
                            const current = prev[attr.id] || [];
                            // Logic for single selection (radio) vs multi
                            // Odoo display_type: 'radio', 'select', 'color'
                            const display_type = attr.display_type || 'radio';
                            const isSingle = display_type !== 'checkbox'; // Assuming checkbox for multi, others single

                            if (isSingle) return { ...prev, [attr.id]: [val.id] };

                            return {
                              ...prev,
                              [attr.id]: current.includes(val.id)
                                ? current.filter(id => id !== val.id)
                                : [...current, val.id]
                            };
                          });
                        }}
                        className={`px-5 py-2 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-10 ${isSelected ? 'bg-accent-gold border-accent-gold text-primary shadow-lg shadow-accent-gold/20' : 'bg-white/5 border-white/10 text-white/70'
                          }`}
                      >
                        {val.name} {val.price_extra ? `(+${formatPrice(val.price_extra)})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Combo Lines Section */}
            {!isLoadingDetails && comboLines.map((line: ComboLine) => (
              <div key={line.id} className="space-y-4">
                <Label className="mb-0 text-white/70">{line.name} {line.required && <span className="text-accent-chili">*</span>}</Label>
                <div className="flex flex-wrap gap-2">
                  {line.products?.map((prod: Product) => {
                    const isSelected = comboSelections[line.id]?.includes(prod.id);
                    return (
                      <button
                        key={prod.id}
                        onClick={() => {
                          setComboSelections(prev => {
                            // Combo lines are typically single select unless max_quantity > 1
                            // Assuming single select for now as per UI screenshot structure "Option 1"
                            return { ...prev, [line.id]: [prod.id] };
                          });
                        }}
                        className={`px-5 py-2 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-10 ${isSelected ? 'bg-accent-gold border-accent-gold text-primary shadow-lg shadow-accent-gold/20' : 'bg-white/5 border-white/10 text-white/70'
                          }`}
                      >
                        {prod.name} {prod.list_price ? `(+${formatPrice(prod.list_price)})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <Label htmlFor="product-special-requests" className="text-white/70">Special Requests</Label>
              <textarea
                id="product-special-requests"
                placeholder="e.g. Allergies, less oil, extra spicy..."
                className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-accent-gold transition-colors min-h-[100px]"
                value={configInstructions}
                onChange={(e) => setConfigInstructions(e.target.value)}
                aria-label="Special cooking instructions or dietary requirements"
              />
            </div>
          </div>

          <div className="p-6 md:p-10 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 bg-neutral-900/90 backdrop-blur-md sticky bottom-0 left-0 w-full z-10 shrink-0">
            <div className="text-center md:text-left">
              <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">Item Total</p>
              <p className="text-4xl font-display font-bold text-accent-gold">{formatPrice(currentConfigPrice)}</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <Button variant="ghost" onClick={onClose} className="hidden md:flex">Cancel</Button>
              <Button variant="secondary" onClick={handleAddToCart} disabled={!session.isOpen} className="flex-grow py-4 md:px-10 bg-accent-gold border-accent-gold">
                {!session.isOpen ? 'Store Closed' : 'Add to Bag'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
