import { odooCall } from '@/lib/odoo-client';
import { calculateOrderTotal, expandCartItems } from './odoo-order-utils'
import { logToFile } from '@/lib/debug-logger';
import type { OrderPayload } from './types'
import { OdooRecord, PosOrder } from '@/lib/types';

/**
 * Handles the actual creation and fulfillment of a POS order in Odoo.
 * This should be called primarily from a secure backend context (like a Stripe Webhook).
 */
export async function fulfillOdooOrder(
  payload: OrderPayload,
  stripePaymentIntentId?: string,
) {
  logToFile('--- Fulfilling Odoo POS Order ---', { payload, stripePaymentIntentId });
  console.log('--- Fulfilling Odoo POS Order ---')
  console.log('Payload:', JSON.stringify(payload, null, 2))

  const {
    orderLines: cartItems,
    customer,
    customer_note: notes,
    paymentMethod,
    orderType,
  } = payload

  // 0. IDEMPOTENCY CHECK: Ensure we don't process the same Stripe ID twice
  if (stripePaymentIntentId) {
    const shortId = stripePaymentIntentId.slice(-6)
    console.log(`[Fulfillment] Checking for existing order with Stripe suffix: ${shortId}`)
    const existingOrders = await odooCall<any[]>('pos.order', 'search_read', {
      domain: [['name', 'ilike', `Online Order - ${shortId}`]],
      fields: ['id', 'pos_reference', 'state', 'account_move'],
      limit: 1,
    })

    if (existingOrders.length > 0) {
      const order = existingOrders[0]
      console.log(`✅ [Fulfillment] Idempotency hit: Order already exists (ID: ${order.id}, Ref: ${order.pos_reference})`)
      return {
        orderId: order.id,
        posReference: order.pos_reference,
        state: order.state,
        accountMoveName: Array.isArray(order.account_move) ? order.account_move[1] : '',
        invoiceId: Array.isArray(order.account_move) ? order.account_move[0] : order.account_move
      }
    }
  }

  // 1 & 2. Find active POS session and its payment methods
  console.log('[Fulfillment] Searching for active POS session and config...')
  const activeSessions = await odooCall<any[]>('pos.session', 'search_read', {
    domain: [['state', '=', 'opened']],
    fields: ['id', 'config_id', 'user_id'],
    limit: 1,
  })

  if (!activeSessions || activeSessions.length === 0) {
    logToFile('❌ CRITICAL: No OPEN POS Session found in Odoo. Orders cannot be created.');
    console.error('[Fulfillment] No active POS session found!')
    throw new Error('No active POS session found. Restaurant might be closed.')
  }

  const session = activeSessions[0]
  const sessionId = session.id
  // Support an abortable fetch with a default timeout to avoid long hangs
  const timeoutMs = Number(process.env.ODOO_CALL_TIMEOUT_MS || 30000)
  const controller = new AbortController()
  logToFile(`[fulfillment] Using opened POS Session: ${sessionId}`);
  const configId = session.config_id[0]
  const userId = session.user_id ? session.user_id[0] : false

  // Directly fetch payment methods for this config
  const posConfig = await odooCall<any[]>('pos.config', 'read', {
    ids: [configId],
    fields: ['payment_method_ids'],
  })

  const paymentMethodIds = posConfig[0].payment_method_ids

  // 2. Map Payment Method (Map to 'Stripe' for online payments in Odoo 19)
  let targetMethodName = 'Stripe'
  if (paymentMethod === 'cash') targetMethodName = 'Cash'

  console.log(
    `[Fulfillment] Mapping payment method for name: ${targetMethodName}`,
  )

  // ODOO 19 CAUTION: Methods with is_online_payment=true cannot be used via add_payment
  // without a pre-existing accounting transaction. Since we move funds externally via Stripe,
  // we must map to an "Offline" (standard) Odoo POS method to clear the order record.
  let paymentMethods = await odooCall<any[]>(
    'pos.payment.method',
    'search_read',
    {
      domain: [
        ['id', 'in', paymentMethodIds],
        ['name', 'ilike', targetMethodName],
        ['is_online_payment', '=', false],
      ],
      fields: ['id', 'name', 'is_online_payment'],
      limit: 1,
    },
  )

  if (!paymentMethods || paymentMethods.length === 0) {
    console.warn(
      `[Fulfillment] No standard (non-online) method named "${targetMethodName}" found.`,
    )
    // Fallback to any non-online, non-cash method (e.g. 'Card')
    const fallback = await odooCall<any[]>(
      'pos.payment.method',
      'search_read',
      {
        domain: [
          ['id', 'in', paymentMethodIds],
          ['is_cash_count', '=', false],
          ['is_online_payment', '=', false],
        ],
        fields: ['id', 'name', 'is_online_payment'],
        limit: 1,
      },
    )

    if (fallback.length > 0) {
      console.log(
        `[Fulfillment] Falling back to standard method: ${fallback[0].name}`,
      )
      paymentMethods = fallback
    } else {
      // Last resort: use anything available
      const anyMethod = await odooCall<any[]>(
        'pos.payment.method',
        'search_read',
        {
          domain: [['id', 'in', paymentMethodIds]],
          fields: ['id', 'name', 'is_online_payment'],
          limit: 1,
        },
      )
      if (!anyMethod.length)
        throw new Error('No suitable POS payment method found.')
      paymentMethods = anyMethod
    }
  }

  const selectedMethod = paymentMethods[0]
  const paymentMethodId = selectedMethod.id as number
  console.log(
    `[Fulfillment] Final Payment Method: ${selectedMethod.name} (ID: ${paymentMethodId})`,
  )
  if (selectedMethod.name !== targetMethodName) {
    console.warn(
      `⚠️ [Fulfillment] Payment method mismatch! UI wanted "${targetMethodName}" but used "${selectedMethod.name}" due to Odoo 19 restrictions or missing config.`,
    )
  }

  // 3. Find or Create Partner
  console.log(`[Fulfillment] Handling partner for email: ${customer.email}`)
  let partnerId: number
  const existingPartners = await odooCall<OdooRecord[]>(
    'res.partner',
    'search_read',
    {
      domain: [['email', '=', customer.email]],
      fields: ['id'],
      limit: 1,
    },
  )

  if (existingPartners.length > 0) {
    partnerId = existingPartners[0].id as number
    logToFile(`[fulfillment] Found existing partner: ${partnerId}`);
    console.log(`[Fulfillment] Existing partner found: ${partnerId}`)
  } else {
    logToFile('[fulfillment] Partner not found. Creating new partner...');
    console.log('[Fulfillment] Creating new partner...')
    const newPartnerIds = await odooCall<number[]>('res.partner', 'create', {
      vals_list: [
        {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          street: customer.street,
          city: customer.city,
          zip: customer.zip,
          country_id: 236, // Assuming India
        },
      ],
    })
    partnerId = newPartnerIds[0]
    logToFile(`[fulfillment] New partner created with ID: ${partnerId}`);
    console.log(`[Fulfillment] New partner created: ${partnerId}`)
  }

  // 3.5. Update partner with latest details for persistence
  try {
    console.log(`[Fulfillment] Updating partner ${partnerId} with current checkout info...`)
    await odooCall('res.partner', 'write', {
      ids: [partnerId],
      vals: {
        phone: customer.phone,
        street: customer.street,
        city: customer.city,
        zip: customer.zip,
      }
    })
  } catch (updateErr) {
    console.warn(`[Fulfillment] Non-fatal: Failed to update partner info:`, updateErr)
  }

  // 4. Calculate Totals
  console.log('[Fulfillment] Resolving order breakdown...')
  
  const hasPreCalculatedData = cartItems.every(item => 
    (item as any).price_unit_incl !== undefined && (item as any).tax_ids !== undefined
  )

  let orderBreakdown: { 
    lines: any[], 
    amount_total: number, 
    amount_tax: number 
  }

  if (hasPreCalculatedData) {
    console.log('[Fulfillment] Using pre-calculated pricing data from metadata.')
    const lines = cartItems.map(item => {
      const unitIncl = (item as any).price_unit_incl;
      const unitExcl = item.list_price || 0; // 'pr' from metadata
      const qty = item.quantity;

      return {
        ...item,
        price_unit_incl: unitIncl,
        price_subtotal: unitExcl * qty,
        price_subtotal_incl: unitIncl * qty,
      }
    })
    const total = lines.reduce((sum, l) => sum + l.price_subtotal_incl, 0)
    const tax = lines.reduce((sum, l) => sum + (l.price_subtotal_incl - l.price_subtotal), 0)
    
    orderBreakdown = {
      lines,
      amount_total: Math.round(total),
      amount_tax: Math.round(tax)
    }
  } else {
    console.log('[Fulfillment] Recalculating totals from Odoo product data...')
    orderBreakdown = await calculateOrderTotal(cartItems)
  }

  console.log('[Fulfillment] Order Totals:', {
    total: orderBreakdown.amount_total,
    tax: orderBreakdown.amount_tax,
  })

  // 5. Build REST-style nested lines for custom Odoo API
  // The Odoo create_api_order expects a nested list of lines with combo_line_ids.
  // We reconstruct the hierarchy from the flat list (where parent has price and children are children).
  const nestedLinesForApi: any[] = []
  let currentParent: any = null

  orderBreakdown.lines.forEach((line) => {
    const isChild = !!(line as any).combo_item_id
    
    if (!isChild) {
      if (currentParent) nestedLinesForApi.push(currentParent)
      currentParent = {
        product_id: line.product_id,
        qty: line.quantity,
        price_unit: line.list_price || 0,
        note: line.customer_note || '',
        combo_line_ids: []
      }
    } else if (currentParent) {
      currentParent.combo_line_ids.push({
        product_id: line.product_id,
        qty: line.quantity,
        combo_item_id: (line as any).combo_item_id,
        extra_price: line.list_price || 0
      })
    }
  })
  if (currentParent) nestedLinesForApi.push(currentParent)

  const apiOrderPayload = {
    uuid: stripePaymentIntentId || `WEB-${Date.now()}`,
    session_id: sessionId,
    partner_id: partnerId,
    lines: nestedLinesForApi,
    payment_method_id: paymentMethodId,
    payment_method: (paymentMethod === 'stripe' || paymentMethod === 'demo_online') ? 'online' : 'cash',
    source: 'native_web',
    customer_name: customer.name,
    customer_phone: customer.phone,
    delivery_address: `${customer.street}, ${customer.city}, ${customer.zip}`,
    notes: notes || '',
    amount_paid: orderBreakdown.amount_total,
  }

  // 6. Create POS Order via Custom API (Ensures Real-time Notifications)
  console.log(`🚀 [Fulfillment] Creating POS Order via create_api_order...`)
  let orderId: number | null = null
  try {
    const result = await odooCall<any>('pos.order', 'create_api_order', {
      order_data: apiOrderPayload
    })
    
    // Result might be an ID or an object depending on the API implementation
    orderId = typeof result === 'object' ? result.id : result
    if (!orderId) throw new Error('Odoo API did not return an order ID')
    
    console.log(`✅ [Fulfillment] POS Order created & Notified with ID: ${orderId}`)
    logToFile(`✅ POS Order created via custom API (ID: ${orderId})`);
  } catch (e: any) {
    console.error('❌ [Fulfillment] Failed to create API order:', e.message)
    throw e
  }

  // 7. Generate Invoice
  console.log('[Fulfillment] Generating invoice...')
  try {
    // Note: odooCall now has a 30s timeout by default
    await odooCall('pos.order', 'action_pos_order_invoice', { ids: [orderId!] })
    console.log('✅ [Fulfillment] Invoice generated.')
  } catch (e: any) {
    console.warn(`[Fulfillment] Invoice timeout/error: ${e.message}. Verifying existence...`)
  }

  // 8. Final Verification & State Check
  const orderRefetched = await odooCall<any[]>('pos.order', 'read', {
    ids: [orderId!],
    fields: ['pos_reference', 'state', 'account_move', 'is_invoiced'],
  })

  const orderRecord = orderRefetched?.[0]
  if (orderRecord?.account_move) {
    const moveId = Array.isArray(orderRecord.account_move) ? orderRecord.account_move[0] : orderRecord.account_move
    const move = await odooCall<any[]>('account.move', 'read', { ids: [moveId], fields: ['state'] })
    if (move?.[0]?.state === 'draft') {
      await odooCall('account.move', 'action_post', { ids: [moveId] }).catch(() => {})
    }
  } else if (orderRecord?.state === 'paid' && !orderRecord.is_invoiced) {
    // If invoice failed but paid, move to done
    await odooCall('pos.order', 'write', { ids: [orderId!], vals: { state: 'done' } }).catch(() => {})
  }

  console.log(`✅ [Fulfillment] Order #${orderId} processed. Final State: ${orderRecord?.state || 'done'}`)
  
  return {
    orderId,
    posReference: orderRecord?.pos_reference || `Order #${orderId}`,
    state: orderRecord?.state || 'done',
    accountMoveName: Array.isArray(orderRecord?.account_move) ? orderRecord.account_move[1] : '',
    invoiceId: Array.isArray(orderRecord?.account_move) ? orderRecord.account_move[0] : orderRecord.account_move
  }
}
