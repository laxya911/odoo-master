import { odooCall } from './odoo-client'
import type { OrderLineItem, CartItem } from './types'

export async function calculateOrderTotal(orderLines: OrderLineItem[]) {
  // Fetch product tax relations for all products
  const productIds = Array.from(new Set(orderLines.map((i) => i.product_id)))
  const productsWithData = await odooCall<
    Array<{ id: number; taxes_id: number[]; list_price: number }>
  >('product.product', 'read', {
    ids: productIds,
    fields: ['id', 'taxes_id', 'list_price'],
  })

  const productDataMap: Record<
    number,
    { taxes_id: number[]; list_price: number }
  > = {}
  for (const prod of productsWithData) {
    productDataMap[prod.id] = {
      taxes_id: prod.taxes_id || [],
      list_price: prod.list_price || 0,
    }
  }

  // Fetch Company Default Tax if needed
  let defaultTaxId: number | null = null
  const anyProductHasNoTax = Object.values(productDataMap).some(p => p.taxes_id.length === 0)
  
  if (anyProductHasNoTax) {
    const companies = await odooCall<any[]>('res.company', 'search_read', {
      domain: [],
      fields: ['account_sale_tax_id'],
      limit: 1
    })
    defaultTaxId = companies[0]?.account_sale_tax_id?.[0] || null
  }

  // Collect all tax ids used and fetch tax records
  const allTaxIds = Array.from(
    new Set(Object.values(productDataMap).flatMap((p) => p.taxes_id)),
  )
  if (defaultTaxId && !allTaxIds.includes(defaultTaxId)) {
    allTaxIds.push(defaultTaxId)
  }

  const taxes =
    allTaxIds.length > 0
      ? await odooCall<
          Array<{
            id: number
            amount: number
            amount_type: string
            price_include: boolean
          }>
        >('account.tax', 'read', {
          ids: allTaxIds,
          fields: ['id', 'amount', 'amount_type', 'price_include'],
        })
      : []

  const taxById: Record<
    number,
    { id: number; amount: number; amount_type: string; price_include: boolean }
  > = {}
  for (const t of taxes) {
    taxById[t.id] = t
  }

  let computedAmountTax = 0
  let computedAmountTotal = 0

  const processedLines = orderLines.map((item) => {
    const qty = item.quantity
    const pData = productDataMap[item.product_id] || {
      taxes_id: [],
      list_price: 0,
    }
    let applicableTaxIds: number[] = []
    if (Array.isArray(pData.taxes_id) && pData.taxes_id.length > 0) {
      applicableTaxIds = pData.taxes_id
    } else if (defaultTaxId) {
      applicableTaxIds = [defaultTaxId]
    }

    // Odoo's list_price is the price excluding tax if tax is excluded, 
    // and price including tax if tax is included.
    const priceUnit = item.list_price ?? pData.list_price
    
    // 1. Identify included taxes to get the "extra" base price
    let totalIncludedRate = 0
    for (const tid of applicableTaxIds) {
      const tx = taxById[tid]
      if (tx && tx.price_include) {
        totalIncludedRate += tx.amount / 100
      }
    }

    // 2. Extract TRUE pre-tax base price
    // If tax is included, list_price = Base * (1 + rate)
    // If tax is excluded, list_price = Base
    let basePriceExcl = priceUnit
    if (totalIncludedRate > 0) {
      basePriceExcl = priceUnit / (1 + totalIncludedRate)
    }
    basePriceExcl = Number(basePriceExcl.toFixed(2))

    const subtotalExcl = basePriceExcl * qty
    let lineTaxBalance = 0

    // 3. Apply ALL taxes to the base price
    for (const tid of applicableTaxIds) {
      const tx = taxById[tid]
      if (!tx) continue
      lineTaxBalance += subtotalExcl * (tx.amount / 100)
    }

    lineTaxBalance = Number(lineTaxBalance.toFixed(2))
    const lineTotal = subtotalExcl + lineTaxBalance
    const priceUnitIncl = Number((lineTotal / qty).toFixed(2))

    computedAmountTax += lineTaxBalance
    computedAmountTotal += lineTotal

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      list_price: priceUnit, // Original list price
      price_unit_incl: priceUnitIncl, // TRUE targeted inclusive price
      price_subtotal: subtotalExcl,
      price_subtotal_incl: lineTotal,
      tax_ids: applicableTaxIds,
      customer_note: item.customer_note || '',
      // Odoo 19 Linkage
      combo_id: item.combo_id,
      combo_item_id: item.combo_item_id,
    }
  })

  return {
    lines: processedLines as unknown as Array<
      OrderLineItem & {
        price_unit_incl: number
        price_subtotal: number
        price_subtotal_incl: number
        tax_ids: number[]
        customer_note: string
      }
    >,
    amount_tax: Math.round(computedAmountTax),
    amount_total: Math.round(computedAmountTotal),
  }
}

/**
 * Expands a list of CartItems into a flat list of OrderLineItems.
 * Handles Odoo 19 combo expansion (1 parent line + N child lines).
 */
export function expandCartItems(cartItems: CartItem[]): OrderLineItem[] {
  const expanded: OrderLineItem[] = []

  // Recursive helper to expand combo selections
  const expandCombo = (
    selections: any[],
    parentQty: number,
  ): OrderLineItem[] => {
    const lines: OrderLineItem[] = []
    for (const selection of selections) {
      const comboId = selection.combo_id || selection.combo_line_id
      const productIds = selection.product_ids || []
      const comboItemIds = selection.combo_item_ids || []
      const extraPrices = selection.extra_prices || []
      const attributes = selection.combo_item_attributes || []
      const subSelections = selection.sub_selections || []

      for (let i = 0; i < productIds.length; i++) {
        const pid = productIds[i]
        const ciid = comboItemIds[i]
        const price = extraPrices[i] || 0
        const itemAttrs = attributes[i] // Array of attribute IDs for this specific product
        const itemSubs = subSelections[i] // Array of combo selections for this specific product

        // Since productIds already contains duplicates if quantity > 1,
        // we just push one line per entry here.
        lines.push({
          product_id: pid,
          quantity: parentQty,
          list_price: price,
          combo_id: comboId,
          combo_item_id: ciid,
          attribute_value_ids:
            itemAttrs && itemAttrs.length > 0 ? itemAttrs : undefined,
          customer_note: '',
        })

        // Recursively add nested combos for this item
        if (itemSubs && itemSubs.length > 0) {
          lines.push(...expandCombo([itemSubs], parentQty))
        }
      }
    }
    return lines
  }

  for (const item of cartItems) {
    let subItemTotalExtra = 0
    let childLines: OrderLineItem[] = []

    if (item.meta?.combo_selections) {
      childLines = expandCombo(item.meta.combo_selections, item.quantity)
      // Calculate total extra price from ALL expanded child lines
      // (Note: Odoo usually expects the parent to have the base price and children have the extra)
      subItemTotalExtra = childLines.reduce((sum, cl) => sum + (cl.list_price || 0), 0)
    }

    // 2. Add Parent Line. The parent's list_price is fixed (e.g. 2000).
    const basePrice = item.product.list_price || 0
    
    // Always add parent line for POS combos (it's the anchor)
    // We initially set list_price to 0 for combo parents. If it turns out it's NOT a combo
    // (no child lines), we immediately restore it.
    expanded.push({
      product_id: item.product.id,
      quantity: item.quantity,
      list_price: 0, 
      attribute_value_ids: item.meta?.attribute_value_ids,
      customer_note: item.notes || item.meta?.notes || '',
    })

    // 3. Add Child Lines and shift price
    if (childLines.length > 0) {
      // FIX for Odoo Accounting Display Type Validation Error:
      // Combo parents usually do not have income accounts configured in Odoo.
      // Odoo POS native dynamically fractions the parent's $2000 price over the child lines ($927, $927, $146 etc)
      // to generate valid journal items using the children's accounts.
      // We replicate this safely by just shifting the parent's basePrice to the first child.
      childLines[0].list_price = (childLines[0].list_price || 0) + basePrice;
    } else {
      // It's a standard product without combo children. Restore base price.
      expanded[expanded.length - 1].list_price = basePrice;
    }

    expanded.push(...childLines)
  }

  return expanded
}

export async function getCompanyCurrency(): Promise<string> {
  try {
    const companies = await odooCall<any[]>('res.company', 'search_read', {
      domain: [],
      fields: ['currency_id'],
      limit: 1,
    })

    if (companies && companies.length > 0) {
      const currencyId = Array.isArray(companies[0].currency_id)
        ? companies[0].currency_id[0]
        : null
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
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]

/**
 * Converts a decimal amount to the smallest unit for Stripe (e.g., cents for USD, yen for JPY).
 */
export function toSmallestUnit(amount: number, currency: string): number {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase())
  if (isZeroDecimal) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

/**
 * Converts an amount in Stripe's smallest unit back to a decimal amount.
 */
export function fromSmallestUnit(amount: number, currency: string): number {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase())
  if (isZeroDecimal) {
    return amount
  }
  return amount / 100
}
