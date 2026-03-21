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

  // 1. Check if order already exists (Idempotency)
  console.log(`[Fulfillment] Checking for existing order with unique_uuid: ${stripePaymentIntentId}`)
  const existingOrders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
    domain: [['unique_uuid', '=', stripePaymentIntentId]],
    fields: ['id', 'state', 'pos_reference', 'account_move', 'unique_uuid'],
    limit: 1,
  })

  if (existingOrders.length > 0) {
    const order = existingOrders[0]
    console.log(`✅ [Fulfillment] Idempotency hit: Order already exists (ID: ${order.id}, UUID: ${order.unique_uuid})`)
    logToFile(`[fulfillment] Idempotency hit for ${stripePaymentIntentId}: order ${order.id}`);
    return {
      orderId: order.id,
      posReference: order.pos_reference,
      state: order.state,
      accountMoveName: Array.isArray(order.account_move) ? order.account_move[1] : '',
      invoiceId: Array.isArray(order.account_move) ? order.account_move[0] : order.account_move
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
  logToFile(`[fulfillment] Using opened POS Session: ${sessionId}`);
  const configId = session.config_id[0]

  // Directly fetch payment methods for this config
  const posConfig = await odooCall<any[]>('pos.config', 'read', {
    ids: [configId],
    fields: ['payment_method_ids'],
  })

  const paymentMethodIds = posConfig[0].payment_method_ids

  // 2. Map Payment Method (Dynamic lookup for 'Stripe' or 'Card')
  // Fetch all payment methods for this config to log them and find the best match
  const allMethods = await odooCall<any[]>(
    'pos.payment.method',
    'search_read',
    {
      domain: [['id', 'in', paymentMethodIds]],
      fields: ['id', 'name', 'is_cash_count', 'is_online_payment', 'use_payment_terminal'],
    }
  )

  console.log('[Fulfillment] Available POS Payment Methods:', allMethods.map(m => `${m.name} (ID: ${m.id}, Online: ${m.is_online_payment})`).join(', '))
  logToFile(`[fulfillment] Available POS Payment Methods: ${JSON.stringify(allMethods)}`);

  let selectedMethod: any = null;
  const targetMethodName = paymentMethod === 'cash' ? 'Cash' : 'Stripe';

  if (paymentMethod === 'cash') {
    selectedMethod = allMethods.find(m => (m.name.toLowerCase().includes('cash') || m.is_cash_count) && !m.is_online_payment);
  } else {
    // IMPORTANT: In Odoo 17+, 'is_online_payment: true' methods REQUIRE a linked accounting transaction.
    // Since we handle Stripe in Next.js, we MUST use an 'Offline' (Standard) method in Odoo to record the payment.
    const offlineMethods = allMethods.filter(m => !m.is_online_payment);

    // 1. Try to find an exactly named 'Stripe' offline method
    selectedMethod = offlineMethods.find(m => m.name.toLowerCase() === 'stripe');
    
    // 2. Try to find an offline method that includes 'Stripe' in the name
    if (!selectedMethod) {
      selectedMethod = offlineMethods.find(m => m.name.toLowerCase().includes('stripe'));
    }

    // 3. Fallback to any 'Card' or 'Bank' offline method
    if (!selectedMethod) {
      selectedMethod = offlineMethods.find(m => 
        !m.is_cash_count && 
        (m.name.toLowerCase().includes('card') || m.name.toLowerCase().includes('bank'))
      );
    }

    // 4. Last resort: use the first non-cash offline method
    if (!selectedMethod) {
      selectedMethod = offlineMethods.find(m => !m.is_cash_count);
    }
  }

  if (!selectedMethod && allMethods.length > 0) {
    selectedMethod = allMethods[0];
  }

  if (!selectedMethod) {
    throw new Error('No valid payment method found for this POS config.')
  }

  const paymentMethodId = selectedMethod.id as number
  console.log(
    `[Fulfillment] Final Payment Method: ${selectedMethod.name} (ID: ${paymentMethodId})`,
  )
  if (selectedMethod.name !== targetMethodName && !selectedMethod.name.toLowerCase().includes('stripe')) {
    console.warn(
      `⚠️ [Fulfillment] Payment method mismatch! UI wanted "${targetMethodName}" but used "${selectedMethod.name}" due to missing Odoo config.`,
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
          country_id: 236, // Assuming India
        },
      ],
    })
    partnerId = newPartnerIds[0]
    logToFile(`[fulfillment] New partner created with ID: ${partnerId}`);
    console.log(`[Fulfillment] New partner created: ${partnerId}`)
  }

  // 4. Calculate Totals
  console.log('[Fulfillment] Resolving order breakdown via calculateOrderTotal...')
  // The cartItems (orderLines) here are already expanded/flattened by the payment provider 
  // (e.g. StripeAdapter.processSession) and reconstructed from metadata.
  const orderBreakdown = await calculateOrderTotal(cartItems)

  console.log('[Fulfillment] Order Totals:', {
    total: orderBreakdown.amount_total,
    tax: orderBreakdown.amount_tax,
  })

  // 5. Build lines for Custom Odoo API (NESTED format required by create_api_order)
  const nestedLines: any[] = []
  const cidLineMap: Record<string, any> = {}

  // First pass: Create all line objects and map them by CID
  orderBreakdown.lines.forEach((line) => {
    if (line.cid) {
      cidLineMap[line.cid] = {
        product_id: line.product_id,
        qty: line.quantity,
        price_unit: line.list_price || 0,
        note: line.customer_note || '',
        tax_ids: [[6, 0, (line as any).tax_ids || []]],
        attribute_value_ids: line.attribute_value_ids || [], 
        combo_item_id: (line as any).combo_item_id,
        extra_price: line.list_price || 0,
        combo_line_ids: [], // Recursive children
      }
    }
  })

  // Second pass: Build the nesting tree
  orderBreakdown.lines.forEach((line) => {
    if (line.cid) {
      const currentLine = cidLineMap[line.cid]
      if (line.parent_cid && cidLineMap[line.parent_cid]) {
        // This is a child: add to parent's combo_line_ids
        cidLineMap[line.parent_cid].combo_line_ids.push(currentLine)
      } else if (!line.parent_cid) {
        // This is a top-level parent: add to root list
        nestedLines.push(currentLine)
      }
    }
  })

  // 6. Build payload for Custom API (create_api_order)
  // Reverted to NESTED because the custom Python backend uses 'combo_line_ids'.
  const apiOrderPayload = {
    uuid: stripePaymentIntentId,
    name: stripePaymentIntentId, 
    pos_reference: stripePaymentIntentId,
    session_id: sessionId,
    partner_id: partnerId,
    lines: nestedLines, // Nested structure
    amount_total: orderBreakdown.amount_total,
    amount_tax: orderBreakdown.amount_tax,
    amount_paid: orderBreakdown.amount_total,
    amount_return: 0,
    payment_method_id: paymentMethodId,
    payment_amount: orderBreakdown.amount_total,
    stripe_session_id: stripePaymentIntentId,
    to_invoice: true,
    notes: notes, // Overall order note for general_customer_note
    stripe_card_brand: payload.stripeCardDetails?.card_brand,
    stripe_card_last4: payload.stripeCardDetails?.card_no,
    stripe_cardholder_name: payload.stripeCardDetails?.cardholder_name,
    stripe_transaction_id: payload.stripeCardDetails?.transaction_id || stripePaymentIntentId,
  }

  // 7. Create POS Order via Custom API
  console.log(`🚀 [Fulfillment] Creating POS Order via create_api_order...`)
  let orderId: number | null = null
  try {
    const result = await odooCall<any>('pos.order', 'create_api_order', {
      order_data: apiOrderPayload
    })
    
    if (typeof result === 'number') {
      orderId = result;
    } else if (Array.isArray(result) && result.length > 0) {
      orderId = result[0];
    } else if (typeof result === 'object' && result !== null) {
      orderId = result.id || result.result || (Array.isArray(result.ids) ? result.ids[0] : null);
    }

    if (!orderId) throw new Error('Odoo API did not return an order ID')
    
    console.log(`✅ [Fulfillment] POS Order created ID: ${orderId}`)
    logToFile(`✅ POS Order created via custom API (ID: ${orderId})`);
  } catch (e: any) {
    console.error('❌ [Fulfillment] Failed to create API order:', e.message)
    throw e
  }

  // 8. Final Verification & State Check
  console.log('[Fulfillment] Refetching order to verify state...')
  const orderRefetched = await odooCall<any[]>('pos.order', 'read', {
    ids: [orderId!],
    fields: ['pos_reference', 'state', 'account_move'],
  })

  const orderRecord = orderRefetched?.[0]
  const finalState = orderRecord?.state || 'done'
  console.log(`✅ [Fulfillment] Order #${orderId} processed. Final State: ${finalState}`)
  
  return {
    orderId,
    posReference: orderRecord?.pos_reference || stripePaymentIntentId,
    state: finalState,
    accountMoveName: Array.isArray(orderRecord?.account_move) ? orderRecord.account_move[1] : (typeof orderRecord?.account_move === 'string' ? orderRecord.account_move : ''),
    invoiceId: Array.isArray(orderRecord?.account_move) ? orderRecord.account_move[0] : orderRecord.account_move
  }
}
