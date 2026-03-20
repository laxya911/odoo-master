import { Product, ProductAttribute, CartItemMeta, ComboLine } from './types'

export interface PricingResult {
  unitPrice: number
  totalPaid: number
  totalTax: number
  netAmount: number
}

/**
 * Calculates the final price of a configured product (CartItem).
 * 
 * @param product The base product record
 * @param meta Selections for attributes and combos
 * @param taxesMap Dictionary of tax records from Odoo
 * @param defaultTaxId Fallback tax ID if product has none
 * @returns PricingResult containing rounded JPY values
 */
export function calculateItemPricing(
  product: Product,
  meta: CartItemMeta | undefined,
  taxesMap: Record<number, { id: number; name: string; amount: number; price_include: boolean }>,
  defaultTaxId: number | null,
  currency: { name: string; decimal_places: number } = { name: 'INR', decimal_places: 2 }
): PricingResult {
  const dp = currency.decimal_places

  let unitBasePrice = product.list_price || 0

  // 1. Add top-level attributes
  if (meta?.attribute_price_extra) {
    unitBasePrice += meta.attribute_price_extra
  }

  // 2. Add combo selections
  // If the meta contains pre-calculated extra_prices (from handleAddToCart), use them.
  // Otherwise, we might need to recalculate? 
  // For the Cart UI, we rely on the pre-calculated extra_prices in the meta.
  if (meta?.combo_selections) {
    meta.combo_selections.forEach(sel => {
      if (sel.extra_prices) {
        sel.extra_prices.forEach(p => {
          unitBasePrice += p
        })
      }
    })
  }

  // 3. Tax Alignment
  // Ensure we have a valid array of tax IDs
  let applicableTaxIds: number[] = []
  if (Array.isArray(product.taxes_id) && product.taxes_id.length > 0) {
    applicableTaxIds = product.taxes_id
  }

  let totalIncludedRate = 0
  applicableTaxIds.forEach(tid => {
    const tx = taxesMap[tid]
    if (tx && tx.price_include) totalIncludedRate += (tx.amount / 100)
  })

  // Extract pre-tax base
  const baseTotal = unitBasePrice / (1 + totalIncludedRate)

  // Add ALL taxes
  let totalTaxRate = 0
  applicableTaxIds.forEach(tid => {
    const tx = taxesMap[tid]
    if (tx) totalTaxRate += (tx.amount / 100)
  })

  const finalInclusivePrice = baseTotal * (1 + totalTaxRate)
  
  // Dynamic rounding based on currency.decimal_places
  const roundedPrice = Number(finalInclusivePrice.toFixed(dp))
  const roundedTax = Number((baseTotal * totalTaxRate).toFixed(dp))
  const roundedNet = Number(baseTotal.toFixed(dp))

  return {
    unitPrice: roundedPrice,
    totalPaid: roundedPrice,
    totalTax: roundedTax,
    netAmount: roundedNet
  }
}
