import { odooCall } from './odoo-client'
import { calculateOrderTotal, expandCartItems } from './odoo-order-utils'
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

  // 4. Calculate Totals (Cart items are already expanded by the webhook/caller)
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
    lines: orderBreakdown.lines.map((line, index) => {
      // Basic line dictionary
      const vals: any = {
        product_id: line.product_id,
        qty: line.quantity,
        // The product's tax is EXCLUSIVE (price_include: false, 10%).
        // Odoo adds tax ON TOP of price_unit, so we must send the pre-tax base price.
        // Sending the inclusive price here caused double taxation (e.g. 5280 → 5808).
        // FIX for Display Type Validation Error:
        // Odoo accounting (`account.move.line`) throws an error if `price_unit` is strictly 0 without an explicit display type.
        // If it's a child combo item and the price is 0, we must supply 0 but signal it's a discount/combo element.
        // Better yet, Odoo 19 `pos.order.line` has `is_combo_line` or ignores accounting lines if they aren't revenue generating.
        price_unit: line.list_price || 0,
        price_subtotal: line.price_subtotal || 0,
        price_subtotal_incl: line.price_subtotal_incl || 0,
        tax_ids:
          line.tax_ids && line.tax_ids.length > 0 && (line.list_price || 0) > 0
            ? [[6, 0, line.tax_ids]]
            : [],
        customer_note: line.customer_note || '',
        note: line.customer_note
          ? JSON.stringify([{ note: line.customer_note, colorIndex: 9 }])
          : '',
        // Odoo 19 Combo Linkage
        combo_id: line.combo_id,
        combo_item_id: (line as any).combo_item_id,
        attribute_value_ids:
          line.attribute_value_ids && line.attribute_value_ids.length > 0
            ? [[6, 0, line.attribute_value_ids]]
            : [],
      }

      console.log(`[Fulfillment] Line ${index} (${line.product_id}): qty=${vals.qty}, price_unit=${vals.price_unit}, incl=${vals.price_subtotal_incl}`)
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

    // 5.5. Link Combo Parent and Child Lines (Odoo 19)
    // We created lines in the same order as orderBreakdown.lines.
    // Fetch newly created line IDs to perform the linkage.
    console.log(`[Fulfillment] Linking combo parent/child lines for order ${orderId}...`)
    const createdLines = await odooCall<any[]>('pos.order.line', 'search_read', {
      domain: [['order_id', '=', orderId]],
      fields: ['id', 'product_id'],
      order: 'id asc', // Odoo creates lines in order
    })

    if (createdLines.length === orderBreakdown.lines.length) {
      // Build index-based mapping
      // Note: We need to know which line was supposed to be a parent
      // We'll use the original orderBreakdown structure.
      const linkageUpdates: any[] = []
      
      // First, identify parent lines by product_id and position
      // Actually, expandCartItems adds parent then children.
      // So children of a parent appear immediately after it (or recursively).
      
      let lastParentLineId: number | null = null
      let currentParentProduct: number | null = null

      orderBreakdown.lines.forEach((originalLine, index) => {
        const createdLineId = createdLines[index].id
        
        // In our expansion logic (odoo-order-utils.ts):
        // Parent line has combo_id/combo_item_id as undefined/false
        // Child line has combo_id/combo_item_id as numbers
        const isChild = !!(originalLine as any).combo_item_id
        
        if (!isChild) {
           // This is a parent line
           lastParentLineId = createdLineId
           currentParentProduct = originalLine.product_id
        } else if (lastParentLineId) {
           // This is a child line - link it to the last parent found
           linkageUpdates.push({
             id: createdLineId,
             vals: { 
               combo_parent_id: lastParentLineId,
               // Ensure combo_item_id is sent as an ID, not just list_price
               combo_item_id: (originalLine as any).combo_item_id
             }
           })
        }
      })

      if (linkageUpdates.length > 0) {
        console.log(`[Fulfillment] Applying linkage for ${linkageUpdates.length} child lines...`)
        for (const update of linkageUpdates) {
          await odooCall('pos.order.line', 'write', {
            ids: [update.id],
            vals: update.vals
          }).catch(err => console.warn(`[Fulfillment] Linkage failed for line ${update.id}:`, err))
        }
      }
    } else {
      console.warn(`[Fulfillment] Line count mismatch (${createdLines.length} vs ${orderBreakdown.lines.length}). Skipping automatic linkage.`)
    }

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
        ...(payload.stripeCardDetails ? {
          card_type: payload.stripeCardDetails.card_type,
          card_brand: payload.stripeCardDetails.card_brand,
          card_no: payload.stripeCardDetails.card_no,
          cardholder_name: payload.stripeCardDetails.cardholder_name,
          transaction_id: payload.stripeCardDetails.transaction_id,
        } : {})
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

  // 7b. Generate Invoice
  console.log('[Fulfillment] Generating invoice...')
  let invoiceSuccess = false
  try {
    // action_pos_order_invoice creates the account.move and returns the action for it
    await odooCall('pos.order', 'action_pos_order_invoice', { ids: [orderId] })
    invoiceSuccess = true
    console.log('[Fulfillment] Invoice generated successfully.')
  } catch (e: any) {
    console.warn(
      `[Fulfillment] action_pos_order_invoice failed for order ${orderId}:`,
      e.message,
    )
    if (e.odooError) {
      console.warn('[Fulfillment] Odoo error detail:', JSON.stringify(e.odooError))
    }
  }

  // 7c. Verify and post the account.move
  try {
    const orderRefetched = await odooCall<any[]>('pos.order', 'read', {
      ids: [orderId],
      fields: ['account_move', 'state', 'is_invoiced'],
    })
    console.log(`[Fulfillment] Order state: ${orderRefetched?.[0]?.state}, is_invoiced: ${orderRefetched?.[0]?.is_invoiced}`)

    if (orderRefetched?.[0]?.account_move) {
      const moveId = Array.isArray(orderRefetched[0].account_move)
        ? orderRefetched[0].account_move[0]
        : orderRefetched[0].account_move

      console.log(`[Fulfillment] Linked Account Move ID: ${moveId}. Checking state...`)
      const move = await odooCall<any[]>('account.move', 'read', {
        ids: [moveId],
        fields: ['state'],
      })

      if (move?.[0]?.state === 'draft') {
        console.log('[Fulfillment] Account Move is in DRAFT. Attempting to post...')
        try {
          await odooCall('account.move', 'action_post', { ids: [moveId] })
          console.log('✅ [Fulfillment] Account Move posted → Fully Invoiced.')
        } catch (postErr: any) {
          console.error('[Fulfillment] Failed to post account move:', postErr.message)
          if ((postErr as any).odooError) {
            console.error('[Fulfillment] Odoo post error detail:', JSON.stringify((postErr as any).odooError))
          }
        }
      } else {
        console.log(`[Fulfillment] Account Move state is already: ${move?.[0]?.state}`)
      }
    } else if (!invoiceSuccess) {
      // Invoice generation failed AND no account_move exists.
      // Try setting state to 'done' so the order at least shows as completed.
      console.warn('[Fulfillment] No account_move found. Falling back to done state.')
      try {
        await odooCall('pos.order', 'write', {
          ids: [orderId],
          vals: { state: 'done' },
        })
        console.log('[Fulfillment] Manual state move to done succeeded.')
      } catch (writeErr: any) {
        console.error('[Fulfillment] Final state move failed:', writeErr.message)
      }
    }
  } catch (verifyErr: any) {
    console.error('[Fulfillment] Invoice verification failed:', verifyErr.message)
  }

  // 8. Fetch Reference, Status, and Invoice Details
  const final = await odooCall<any[]>(
    'pos.order',
    'read',
    {
      ids: [orderId],
      fields: ['pos_reference', 'state', 'account_move'],
    },
  )

  const orderRecord = final[0]
  const finalState = orderRecord?.state || 'unknown'
  let accountMoveName = ''
  let invoiceId = null

  if (orderRecord?.account_move) {
    invoiceId = Array.isArray(orderRecord.account_move) ? orderRecord.account_move[0] : orderRecord.account_move
    accountMoveName = Array.isArray(orderRecord.account_move) ? orderRecord.account_move[1] : ''
    
    // 8a. Link Accounting Payment Method for P&L clarity
    if (invoiceId && (paymentMethod === 'stripe' || paymentMethod === 'demo_online')) {
      try {
        const accMethods = await odooCall<any[]>('account.payment.method.line', 'search_read', {
          domain: [['name', 'ilike', 'Stripe'], ['payment_type', '=', 'inbound']],
          fields: ['id'],
          limit: 1
        })
        if (accMethods.length > 0) {
          await odooCall('account.move', 'write', {
            ids: [invoiceId],
            vals: { preferred_payment_method_line_id: accMethods[0].id }
          })
          console.log(`✅ [Fulfillment] Linked accounting payment method to invoice ${invoiceId}`)
        }
      } catch (accErr: any) {
        console.warn('[Fulfillment] Failed to link accounting payment method:', accErr.message)
      }
    }
  }

  console.log(
    `✅ [Fulfillment] Order #${orderId} (Ref: ${orderRecord?.pos_reference}) processed. Final State: ${finalState}`,
  )
  
  return {
    orderId,
    posReference: orderRecord?.pos_reference || `Order #${orderId}`,
    state: finalState,
    accountMoveName,
    invoiceId
  }
}
