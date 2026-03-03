import { odooCall } from './odoo-client'
import { calculateOrderTotal } from './odoo-order-utils'
import type { OrderPayload, OdooRecord } from './types'

/**
 * Handles the actual creation and fulfillment of a POS order in Odoo.
 * This should be called primarily from a secure backend context (like a Stripe Webhook).
 */
export async function fulfillOdooOrder(
  payload: OrderPayload,
  stripePaymentIntentId?: string,
) {
  console.log('--- Fulfilling Odoo POS Order ---')
  console.log('Payload:', JSON.stringify(payload, null, 2))

  const {
    orderLines: cartItems,
    customer,
    customer_note: notes,
    paymentMethod,
    orderType,
  } = payload

  // 1 & 2. Find active POS session and its payment methods in one go if possible
  console.log('[Fulfillment] Searching for active POS session and config...')
  const activeSessions = await odooCall<any[]>('pos.session', 'search_read', {
    domain: [['state', '=', 'opened']],
    fields: ['id', 'config_id'],
    limit: 1,
  })

  if (!activeSessions || activeSessions.length === 0) {
    console.error('[Fulfillment] No active POS session found!')
    throw new Error('No active POS session found. Restaurant might be closed.')
  }

  const session = activeSessions[0]
  const sessionId = session.id
  const configId = session.config_id[0]

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
    console.log(`[Fulfillment] Existing partner found: ${partnerId}`)
  } else {
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
    console.log(`[Fulfillment] New partner created: ${partnerId}`)
  }

  // 4. Calculate Totals
  console.log('[Fulfillment] Calculating server-side totals...')
  const orderBreakdown = await calculateOrderTotal(cartItems)
  console.log('[Fulfillment] Totals:', {
    total: orderBreakdown.amount_total,
    tax: orderBreakdown.amount_tax,
  })

  const today = new Date().toISOString().split('T')[0]

  // Map orderType to Odoo 19 pos.preset IDs (1: Takeout, 2: Dine In, 3: Delivery)
  const presetIdMap: Record<string, number> = {
    takeout: 1,
    'dine-in': 2,
    delivery: 3,
  }
  const presetId = presetIdMap[orderType as string] || 3 // Default to Delivery

  const orderData = {
    name: `Online Order - ${stripePaymentIntentId ? stripePaymentIntentId.slice(-6) : 'WEB'}`,
    session_id: sessionId,
    partner_id: partnerId,
    lines: orderBreakdown.lines
      .filter((line) => line.price_subtotal_incl > 0 || !line.combo_id) // Strict invoicing guard: skip $0 components but keep $0 parents
      .map((line) => {
        // Basic line dictionary
        const vals: any = {
          product_id: line.product_id,
          qty: line.quantity,
          price_unit: line.list_price,
          price_subtotal: line.price_subtotal || 0,
          price_subtotal_incl: line.price_subtotal_incl || 0,
          tax_ids: line.tax_ids.length > 0 ? [[6, 0, line.tax_ids]] : [],
          // CONFIRMED from Odoo 19 POS JS source (lineScreenValues getter):
          // - `customer_note` is rendered with t-esc (plain text)
          // - `note` is JSON.parsed. Native format: [{"note": "...", "colorIndex": 9}]
          customer_note: line.customer_note || '',
          note: line.customer_note
            ? JSON.stringify([{ note: line.customer_note, colorIndex: 9 }])
            : '',
          // Odoo 19 Combo Linkage
          combo_id: line.combo_id,
          combo_line_id: line.combo_line_id,
          combo_item_id: line.combo_item_id,
        }

        return [0, 0, vals]
      }),
    to_invoice: true,
    amount_tax: orderBreakdown.amount_tax,
    amount_total: orderBreakdown.amount_total,
    amount_paid: 0,
    amount_return: 0,
    source: 'mobile', // Odoo 19 specific for self-order
    is_api_order: true,
    api_source: 'native_web',
    delivery_status: 'received', // POS "Delivery" tab visibility
    shipping_date: today,
    preset_id: presetId, // Maps to Dine In / Takeout / Delivery tabs
    // general_customer_note and api_order_notes are for backend display
    general_customer_note: (typeof notes === 'string' && notes.trim()) ? notes.trim() : '',
    api_order_notes: (typeof notes === 'string' && notes.trim()) ? notes.trim() : '',
  }

  // 5. Create POS Order
  console.log(
    `🚀 [Fulfillment] Creating POS Order for Partner ID: ${partnerId}...`,
  )
  console.log('[Fulfillment] Order Data:', JSON.stringify(orderData, null, 2))
  let orderId: number | null = null
  try {
    const orderIds = await odooCall<number[]>('pos.order', 'create', {
      vals_list: [orderData],
    })
    if (!orderIds || !orderIds.length)
      throw new Error('Odoo returned empty ID list for order creation')
    orderId = orderIds[0]
    console.log(`✅ [Fulfillment] POS Order created with ID: ${orderId}`)
  } catch (e: any) {
    console.error(
      '❌ [Fulfillment] Failed to create POS Order (pos.order). Path: pos.order.create',
    )
    console.error('Error Message:', e.message)
    console.error('Error Details:', e.odooError || e)
    if (e.stack) console.error('Stack:', e.stack)
    // nothing to cleanup yet since orderId is null
    throw e
  }

  // 6. Add Payment
  console.log(
    `💳 [Fulfillment] Adding payment of ${orderBreakdown.amount_total} using Method ID: ${paymentMethodId}...`,
  )
  try {
    await odooCall('pos.order', 'add_payment', {
      ids: [orderId!],
      data: {
        pos_order_id: orderId,
        amount: orderBreakdown.amount_total,
        payment_method_id: paymentMethodId,
      },
    })
    console.log('✅ [Fulfillment] Payment added successfully.')
  } catch (e: any) {
    console.error('❌ [Fulfillment] Failed to add payment to order:', e.message)
    console.error('Error Details:', e.odooError || e)
    if (e.stack) console.error('Stack:', e.stack)
    // attempt cleanup of half-created order
    if (orderId) {
      try {
        // try deleting first, if it fails archive/cancel as fallback
        await odooCall('pos.order', 'unlink', { ids: [orderId] })
        console.log('[Fulfillment] Rolled back partial order by unlinking.')
      } catch (cleanupErr) {
        console.warn(
          '[Fulfillment] Unable to unlink order during rollback, attempting cancel/archive',
          cleanupErr,
        )
        try {
          await odooCall('pos.order', 'write', {
            ids: [orderId],
            vals: { active: false, state: 'cancel' },
          })
          console.log('[Fulfillment] Order archived/cancelled during rollback.')
        } catch (archiveErr) {
          console.error(
            '[Fulfillment] Cleanup failed on order after payment error:',
            archiveErr,
          )
        }
      }
    }
    throw e
  }

  // 7. Validate & Invoice
  console.log('[Fulfillment] Moving order to paid state...')
  try {
    await odooCall('pos.order', 'action_pos_order_paid', { ids: [orderId] })
    console.log('✅ [Fulfillment] Order moved to paid state.')
  } catch (e: any) {
    console.error(
      '❌ [Fulfillment] Failed to move order to paid state:',
      e.message,
    )
    console.error('Error Details:', e.odooError || e)
  }

  try {
    console.log('[Fulfillment] Generating invoice...')
    // Generate invoice - this moves the order towards Invoiced/Done state
    await odooCall('pos.order', 'action_pos_order_invoice', { ids: [orderId] })
    console.log('[Fulfillment] Invoice generated successfully.')
  } catch (e: any) {
    console.warn(
      '[Fulfillment] Invoice generation failed, attempting manual state move:',
      e.message,
    )
    // Fallback: manually move to 'done' state if invoicing fails (optional safeguard)
    try {
      await odooCall('pos.order', 'write', {
        ids: [orderId],
        vals: { state: 'done' },
      })
      console.log('✅ [Fulfillment] Manual state move to done succeeded.')
    } catch (writeErr: any) {
      console.error('[Fulfillment] Final state move failed:', writeErr.message)
    }
  }

  // 8. Fetch Reference & Status
  const final = await odooCall<Array<{ pos_reference: string; state: string }>>(
    'pos.order',
    'read',
    {
      ids: [orderId],
      fields: ['pos_reference', 'state'],
    },
  )

  const finalState = final[0]?.state || 'unknown'
  console.log(
    `✅ [Fulfillment] Order #${orderId} (Ref: ${final[0]?.pos_reference}) processed. Final State: ${finalState}`,
  )
  if (stripePaymentIntentId) {
    console.log(
      `🔗 [Fulfillment] Linked to Stripe Payment Intent: ${stripePaymentIntentId}`,
    )
  }

  return {
    orderId,
    posReference: final[0]?.pos_reference || `Order #${orderId}`,
    state: finalState,
  }
}
