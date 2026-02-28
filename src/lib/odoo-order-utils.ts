import { odooCall } from './odoo-client'
import type { OrderLineItem } from './types'

export async function calculateOrderTotal(orderLines: OrderLineItem[]) {
  // Fetch product tax relations for all products
  const productIds = Array.from(new Set(orderLines.map((i) => i.product_id)))
  const productsWithData = await odooCall<Array<{ id: number; taxes_id: number[]; list_price: number }>>(
    'product.product',
    'read',
    {
      ids: productIds,
      fields: ['id', 'taxes_id', 'list_price'],
    },
  )

  const productDataMap: Record<number, { taxes_id: number[]; list_price: number }> = {}
  for (const prod of productsWithData) {
    productDataMap[prod.id] = {
      taxes_id: prod.taxes_id || [],
      list_price: prod.list_price || 0
    }
  }

  // Collect all tax ids used and fetch tax records
  const allTaxIds = Array.from(new Set(Object.values(productDataMap).flatMap(p => p.taxes_id)))
  const taxes =
    allTaxIds.length > 0
      ? await odooCall<Array<{ id: number; amount: number; amount_type: string; price_include: boolean }>>('account.tax', 'read', {
          ids: allTaxIds,
          fields: ['id', 'amount', 'amount_type', 'price_include'],
        })
      : []
      
  const taxById: Record<number, { id: number; amount: number; amount_type: string; price_include: boolean }> = {}
  for (const t of taxes) {
    taxById[t.id] = t
  }

  let computedAmountTax = 0
  let computedAmountTotal = 0

  const processedLines = orderLines.map((item) => {
    const qty = item.quantity
    const pData = productDataMap[item.product_id] || { taxes_id: [], list_price: 0 }
    const applicableTaxIds = pData.taxes_id
    
    let totalExcludedRate = 0
    for (const tid of applicableTaxIds) {
      const tx = taxById[tid]
      if (tx && !tx.price_include) {
          totalExcludedRate += tx.amount / 100
      }
    }

    // Use fetched list_price if item.list_price is missing/zero
    let priceUnit = item.list_price || pData.list_price
    if (totalExcludedRate > 0) {
        priceUnit = priceUnit / (1 + totalExcludedRate)
        priceUnit = Number(priceUnit.toFixed(2))
    }
    
    const subtotal = priceUnit * qty
    let lineTax = 0
    let priceExcl = subtotal 

    for (const tid of applicableTaxIds) {
      const tx = taxById[tid]
      if (!tx) continue
      
      if (tx.price_include) {
         const rate = tx.amount / 100
         priceExcl = priceExcl / (1 + rate)
         lineTax += priceExcl * rate
      } else {
         lineTax += subtotal * (tx.amount / 100)
      }
    }

    lineTax = Number(lineTax.toFixed(2))
    priceExcl = Number(priceExcl.toFixed(2))
    const lineTotal = priceExcl + lineTax

    computedAmountTax += lineTax
    computedAmountTotal += lineTotal

    return {
      product_id: item.product_id,
      qty,
      price_unit: priceUnit,
      price_subtotal: priceExcl,
      price_subtotal_incl: lineTotal,
      tax_ids: applicableTaxIds,
      customer_note: item.notes || '',
    }
  })

  return {
    lines: processedLines,
    amount_tax: Number(computedAmountTax.toFixed(2)),
    amount_total: Number(computedAmountTotal.toFixed(2)),
  }
}

export async function getCompanyCurrency(): Promise<string> {
  try {
    const companies = await odooCall<any[]>('res.company', 'search_read', {
      domain: [],
      fields: ['currency_id'],
      limit: 1,
    })
    
    if (companies && companies.length > 0) {
      const currencyId = Array.isArray(companies[0].currency_id) ? companies[0].currency_id[0] : null
      if (currencyId) {
        const currencies = await odooCall<any[]>('res.currency', 'read', {
          ids: [currencyId],
          fields: ['name'],
        })
        if (currencies && currencies.length > 0) {
          return (currencies[0].name || 'usd').toLowerCase()
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch company currency:', err)
  }
  return 'usd' // default fallback
}

/**
 * List of zero-decimal currencies supported by Stripe.
 * @see https://stripe.com/docs/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
];

/**
 * Converts a decimal amount to the smallest unit for Stripe (e.g., cents for USD, yen for JPY).
 */
export function toSmallestUnit(amount: number, currency: string): number {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase());
  if (isZeroDecimal) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

/**
 * Converts an amount in Stripe's smallest unit back to a decimal amount.
 */
export function fromSmallestUnit(amount: number, currency: string): number {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase());
  if (isZeroDecimal) {
    return amount;
  }
  return amount / 100;
}
