import { odooCall } from './odoo-client';
import { calculateOrderTotal } from './odoo-order-utils';
import type { OrderPayload, OdooRecord } from './types';

/**
 * Handles the actual creation and fulfillment of a POS order in Odoo.
 * This should be called primarily from a secure backend context (like a Stripe Webhook).
 */
export async function fulfillOdooOrder(payload: OrderPayload, stripePaymentIntentId?: string) {
  console.log('--- Fulfilling Odoo POS Order ---');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  const { orderLines: cartItems, customer, paymentMethod, notes } = payload;

  // 1 & 2. Find active POS session and its payment methods in one go if possible
  console.log('[Fulfillment] Searching for active POS session and config...');
  const activeSessions = await odooCall<any[]>('pos.session', 'search_read', {
    domain: [['state', '=', 'opened']],
    fields: ['id', 'config_id'],
    limit: 1,
  });

  if (!activeSessions || activeSessions.length === 0) {
    console.error('[Fulfillment] No active POS session found!');
    throw new Error('No active POS session found. Restaurant might be closed.');
  }

  const session = activeSessions[0];
  const sessionId = session.id;
  const configId = session.config_id[0];
  
  // Directly fetch payment methods for this config
  const posConfig = await odooCall<any[]>('pos.config', 'read', {
    ids: [configId],
    fields: ['payment_method_ids'],
  });

  const paymentMethodIds = posConfig[0].payment_method_ids;
  
  // 2. Map Payment Method (Map to 'Stripe' for online payments in Odoo 19)
  let targetMethodName = 'Stripe';
  if (paymentMethod === 'cash') targetMethodName = 'Cash';

  console.log(`[Fulfillment] Mapping payment method for name: ${targetMethodName}`);
  
  // ODOO 19 CAUTION: Methods with is_online_payment=true cannot be used via add_payment 
  // without an accounting transaction. For external Stripe payments, we use a standard method.
  let paymentMethods = await odooCall<any[]>('pos.payment.method', 'search_read', {
    domain: [
      ['id', 'in', paymentMethodIds],
      ['name', 'ilike', targetMethodName],
      ['is_online_payment', '=', false] // Prioritize non-online method matching name
    ],
    fields: ['id', 'name', 'is_online_payment'],
    limit: 1,
  });

  if (!paymentMethods || paymentMethods.length === 0) {
    console.warn(`[Fulfillment] No non-online method named "${targetMethodName}" found, trying generic fallback...`);
    // Fallback to any non-online, non-cash method (like 'Card')
    const fallback = await odooCall<any[]>('pos.payment.method', 'search_read', {
      domain: [
        ['id', 'in', paymentMethodIds],
        ['is_cash_count', '=', false],
        ['is_online_payment', '=', false]
      ],
      fields: ['id', 'name', 'is_online_payment'],
      limit: 1,
    });
    
    if (fallback.length > 0) {
      paymentMethods = fallback;
    } else {
      // Last resort: use the first available method even if it's cash
      const anyMethod = await odooCall<any[]>('pos.payment.method', 'search_read', {
        domain: [['id', 'in', paymentMethodIds]],
        fields: ['id', 'name', 'is_online_payment'],
        limit: 1,
      });
      if (!anyMethod.length) {
        console.error('[Fulfillment] No suitable POS payment method found even after multiple fallbacks.');
        throw new Error('No suitable POS payment method found.');
      }
      paymentMethods = anyMethod;
    }
  }

  const selectedMethod = paymentMethods[0];
  const paymentMethodId = selectedMethod.id as number;
  console.log(`[Fulfillment] Selected Payment Method: ${selectedMethod.name} (ID: ${paymentMethodId}, Online: ${selectedMethod.is_online_payment})`);

  // 3. Find or Create Partner
  console.log(`[Fulfillment] Handling partner for email: ${customer.email}`);
  let partnerId: number;
  const existingPartners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
    domain: [['email', '=', customer.email]],
    fields: ['id'],
    limit: 1,
  });

  if (existingPartners.length > 0) {
    partnerId = existingPartners[0].id as number;
    console.log(`[Fulfillment] Existing partner found: ${partnerId}`);
  } else {
    console.log('[Fulfillment] Creating new partner...');
    const newPartnerIds = await odooCall<number[]>('res.partner', 'create', {
      vals_list: [{
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        street: customer.street,
        city: customer.city,
        zip: customer.zip,
        country_id: 236 // Assuming India
      }]
    });
    partnerId = newPartnerIds[0];
    console.log(`[Fulfillment] New partner created: ${partnerId}`);
  }

  // 4. Calculate Totals
  console.log('[Fulfillment] Calculating server-side totals...');
  const orderBreakdown = await calculateOrderTotal(cartItems);
  console.log('[Fulfillment] Totals:', { total: orderBreakdown.amount_total, tax: orderBreakdown.amount_tax });

  const orderData = {
    name: `Online Order - ${stripePaymentIntentId ? stripePaymentIntentId.slice(-6) : 'WEB'}`,
    session_id: sessionId,
    partner_id: partnerId,
    lines: orderBreakdown.lines.map(line => [0, 0, {
      ...line,
      tax_ids: line.tax_ids.length > 0 ? [[6, 0, line.tax_ids]] : [],
      customer_note: line.customer_note || ''
    }]),
    to_invoice: true,
    amount_tax: orderBreakdown.amount_tax,
    amount_total: orderBreakdown.amount_total,
    amount_paid: 0,
    amount_return: 0,
    source: 'mobile', // Odoo 19 specific
    is_api_order: true,
    api_source: 'native_web',
    general_customer_note: notes || '',
    note: undefined, // Explicitly remove invalid field
  };

  // 5. Create POS Order
  console.log(`🚀 [Fulfillment] Creating POS Order for Partner ID: ${partnerId}...`);
  let orderId: number;
  try {
    const orderIds = await odooCall<number[]>('pos.order', 'create', { vals_list: [orderData] });
    if (!orderIds || !orderIds.length) throw new Error('Odoo returned empty ID list for order creation');
    orderId = orderIds[0];
    console.log(`✅ [Fulfillment] POS Order created with ID: ${orderId}`);
  } catch (e: any) {
    console.error('❌ [Fulfillment] Failed to create POS Order (pos.order). Path: pos.order.create');
    console.error('Error Details:', e.message, e.odooError || '');
    throw e;
  }

  // 6. Add Payment
  console.log(`💳 [Fulfillment] Adding payment of ${orderBreakdown.amount_total} using Method ID: ${paymentMethodId}...`);
  try {
    await odooCall('pos.order', 'add_payment', {
      ids: [orderId],
      data: {
        pos_order_id: orderId,
        amount: orderBreakdown.amount_total,
        payment_method_id: paymentMethodId,
      },
    });
    console.log('✅ [Fulfillment] Payment added successfully.');
  } catch (e) {
    console.error('❌ [Fulfillment] Failed to add payment to order:', e);
    throw e;
  }

  // 7. Validate & Invoice
  console.log('[Fulfillment] Moving order to paid state...');
  await odooCall('pos.order', 'action_pos_order_paid', { ids: [orderId] });
  
  try {
    console.log('[Fulfillment] Generating invoice...');
    // Generate invoice - this moves the order towards Invoiced/Done state
    await odooCall('pos.order', 'action_pos_order_invoice', { ids: [orderId] });
    console.log('[Fulfillment] Invoice generated successfully.');
  } catch (e) {
    console.warn('[Fulfillment] Invoice generation failed, attempting manual state move:', e);
    // Fallback: manually move to 'done' state if invoicing fails (optional safeguard)
    try {
        await odooCall('pos.order', 'write', {
            ids: [orderId],
            vals: { state: 'done' }
        });
    } catch (writeErr) {
        console.error('[Fulfillment] Final state move failed:', writeErr);
    }
  }

  // 8. Fetch Reference
  const final = await odooCall<Array<{ pos_reference: string; state: string }>>('pos.order', 'read', {
    ids: [orderId],
    fields: ['pos_reference', 'state']
  });

  console.log(`--- Order #${orderId} fulfilled successfully with state: ${final[0]?.state} ---`);

  return {
    orderId,
    posReference: final[0]?.pos_reference || `Order #${orderId}`
  };
}
