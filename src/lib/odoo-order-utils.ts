import { odooCall } from './odoo-client'
import { CartItem, OrderLineItem } from './types'

/**
 * Calculates the total amount for an Odoo POS order.
 * Handles tax-inclusive and tax-exclusive pricing logic matching Odoo's backend.
 * @param orderLines Flat list of expanded order lines
 * @returns Object with amount_total, amount_tax, and processed lines
 */
export async function calculateOrderTotal(orderLines: OrderLineItem[]) {
  const productIds = [
    ...new Set(orderLines.map((line) => line.product_id).filter(Boolean)),
  ]

  if (productIds.length === 0) {
    return { amount_total: 0, amount_tax: 0, subtotal: 0, lines: [] }
  }

  // Fetch product tax metadata
  const productsWithData = await odooCall<
    Array<{ id: number; taxes_id: number[]; list_price: number }>
  >('product.product', 'read', {
    ids: productIds,
    fields: ['id', 'taxes_id', 'list_price'],
  })

  // Fetch unique tax details
  const taxIds = [
    ...new Set(productsWithData.flatMap((p) => p.taxes_id || [])),
  ]
  let taxesMap: Record<
    number,
    { id: number; amount: number; price_include: boolean }
  > = {}
  if (taxIds.length > 0) {
    const taxData = await odooCall<any[]>('account.tax', 'read', {
      ids: taxIds,
      fields: ['id', 'amount', 'price_include'],
    })
    taxData.forEach((t) => {
      taxesMap[t.id] = t
    })
  }

  // Fetch currency settings for rounding
  const currency = await getCompanyCurrency()
  const dp = currency.decimal_places

  let computedAmountTotal = 0
  let computedAmountTax = 0
  let subtotalBalance = 0

  const processedLines = orderLines.map((item) => {
    const qty = item.quantity || 1
    const product = productsWithData.find((p) => p.id === item.product_id)
    if (!product) return { ...item, price_unit_incl: item.list_price, price_subtotal: item.list_price * qty, price_subtotal_incl: item.list_price * qty, tax_ids: [] }

    // Use price from order line (surcharge) or product list_price
    let priceUnit = (item.list_price !== undefined && item.list_price !== null) ? item.list_price : product.list_price
    
    // ADDITION: Include attribute extras in the base unit price for total calculation
    if (item.price_extra) {
      priceUnit += item.price_extra
    }
    
    const applicableTaxIds = product.taxes_id || []
    let includedTaxRate = 0
    let excludedTaxRate = 0

    applicableTaxIds.forEach((id) => {
      const tax = taxesMap[id]
      if (tax) {
        if (tax.price_include) {
          includedTaxRate += tax.amount / 100
        } else {
          excludedTaxRate += tax.amount / 100
        }
      }
    })

    // Odoo Native Calculation Path:
    // 1. Base Price (Excluded) = priceUnit / (1 + includedRate)
    const basePriceExcl = priceUnit / (1 + includedTaxRate)
    const subtotalExcl = basePriceExcl * qty
    
    // 2. Tax Amount = (subtotalExcl * excludedRate) + (priceUnit - basePriceExcl)*qty
    const includedTaxAmount = (priceUnit - basePriceExcl) * qty
    const excludedTaxAmount = subtotalExcl * excludedTaxRate
    const lineTaxBalance = includedTaxAmount + excludedTaxAmount

    const lineTotal = subtotalExcl + lineTaxBalance
    const priceUnitIncl = lineTotal / qty

    computedAmountTax += lineTaxBalance
    computedAmountTotal += lineTotal
    subtotalBalance += subtotalExcl

    return {
      cid: item.cid,
      parent_cid: item.parent_cid,
      product_id: item.product_id,
      quantity: item.quantity,
      list_price: priceUnit, 
      price_unit_incl: Number(priceUnitIncl.toFixed(dp)), 
      price_subtotal: Number(subtotalExcl.toFixed(dp)),
      price_subtotal_incl: Number(lineTotal.toFixed(dp)),
      tax_ids: applicableTaxIds,
      customer_note: item.customer_note || '',
      attribute_value_ids: item.attribute_value_ids || [],
      combo_id: item.combo_id,
      combo_item_id: item.combo_item_id,
    }
  })

  return {
    lines: processedLines as any[],
    amount_tax: Number(computedAmountTax.toFixed(dp)),
    amount_total: Number(computedAmountTotal.toFixed(dp)),
    subtotal: Number(subtotalBalance.toFixed(dp)),
  }
}

/**
 * Expands a list of CartItems into a flat list of OrderLineItems.
 * Handles Odoo 19 combo expansion (1 parent line + N child lines).
 */
export function expandCartItems(cartItems: CartItem[]): OrderLineItem[] {
  const expanded: OrderLineItem[] = []

  const expandCombo = (
    selections: any[],
    parentQty: number,
    parentCid: string,
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
        const itemAttrs = attributes[i] 
        const itemSubs = subSelections[i] 

        const childCid = `${parentCid}_c${i}_${pid}`

        lines.push({
          cid: childCid,
          parent_cid: parentCid,
          product_id: pid,
          quantity: parentQty,
          list_price: price,
          combo_id: comboId,
          combo_item_id: ciid,
          attribute_value_ids:
            itemAttrs && itemAttrs.length > 0 ? itemAttrs : undefined,
          customer_note: '',
        })

        if (itemSubs && itemSubs.length > 0) {
          lines.push(...expandCombo(itemSubs, parentQty, childCid))
        }
      }
    }
    return lines
  }

  for (const item of cartItems) {
    let childLines: OrderLineItem[] = []

    if (item.meta?.combo_selections) {
      childLines = expandCombo(item.meta.combo_selections, item.quantity, item.id)
    }

    let attributeExtraPrice = item.meta?.attribute_price_extra || 0

    const basePrice = item.product.list_price || 0
    
    expanded.push({
      cid: item.id,
      product_id: item.product.id,
      quantity: item.quantity,
      list_price: basePrice, 
      attribute_value_ids: item.meta?.attribute_value_ids && item.meta.attribute_value_ids.length > 0 ? item.meta.attribute_value_ids : undefined,
      price_extra: attributeExtraPrice,
      customer_note: item.notes || item.meta?.notes || '',
    })

    expanded.push(...childLines)
  }

  return expanded
}

export async function getCompanyCurrency(): Promise<{ name: string; decimal_places: number }> {
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
          fields: ['name', 'decimal_places'],
        })
        if (currencies && currencies.length > 0) {
          return {
            name: (currencies[0].name || 'usd').toLowerCase(),
            decimal_places: currencies[0].decimal_places ?? 2
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch company currency:', err)
  }
  return { name: 'usd', decimal_places: 2 } // default fallback
}

export function toSmallestUnit(amount: number, decimalPlaces: number): number {
  return Math.round(amount * Math.pow(10, decimalPlaces))
}

export function fromSmallestUnit(amount: number, decimalPlaces: number): number {
  return amount / Math.pow(10, decimalPlaces)
}
