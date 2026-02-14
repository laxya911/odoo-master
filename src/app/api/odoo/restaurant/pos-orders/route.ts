'use server'

import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { OdooRecord, OrderPayload } from '@/lib/types'

const ODOO_MODEL = 'pos.order'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sessionId = searchParams.get('session_id')

    const domain: Array<unknown> = []
    if (startDate) {
      domain.push(['date_order', '>=', `${startDate} 00:00:00`])
    }
    if (endDate) {
      domain.push(['date_order', '<=', `${endDate} 23:59:59`])
    }
    if (sessionId) {
      domain.push(['session_id', '=', Number(sessionId)])
    }

    const fieldsDef = await odooCall<Record<string, unknown>>(
      ODOO_MODEL,
      'fields_get',
      {},
    )
    const fieldNames = Object.keys(fieldsDef)

    const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain })

    const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
      domain,
      fields: fieldNames,
      limit,
      offset,
      order: 'date_order desc',
    })

    return NextResponse.json({
      data: records,
      meta: { total, limit, offset, model: ODOO_MODEL, domain },
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error(
      '[API /restaurant/pos-orders GET] Odoo Error:',
      odooError.odooError || odooError.message,
    )
    return NextResponse.json(
      {
        message: odooError.message,
        status: odooError.status,
        odooError: odooError.odooError,
      },
      { status: odooError.status || 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('--- Starting POS Order Creation ---')
  try {
    const payload: OrderPayload = await request.json()
    console.log('Received Payload:', {
      cartItemCount: payload.orderLines?.length,
      customer: payload.customer,
      paymentMethod: payload.paymentMethod,
      orderType: payload.orderType,
    })

    if (!payload.orderLines || payload.orderLines.length === 0) {
      return NextResponse.json(
        { message: 'Cart is empty or orderLines are missing.' },
        { status: 400 },
      )
    }

    const {
      orderLines: cartItems,
      customer,
      paymentMethod,
      orderType,
      total,
    } = payload

    // 1. Find an active POS session and its config
    console.log('Step 1: Finding active POS session...')
    const activeSessions = await odooCall<OdooRecord[]>(
      'pos.session',
      'search_read',
      {
        domain: [['state', '=', 'opened']],
        fields: ['id', 'config_id'],
        limit: 1,
      },
    )

    if (!activeSessions || activeSessions.length === 0) {
      console.error('No active POS session found.')
      return NextResponse.json(
        {
          message:
            'Sorry, the restaurant is currently closed. No active POS session found.',
        },
        { status: 400 },
      )
    }
    const session = activeSessions[0]
    const sessionId = session.id as number
    const configId = (session.config_id as [number, string])[0]
    console.log(
      `Found active session ID: ${sessionId} with Config ID: ${configId}`,
    )

    // 2. Find a payment method from the POS config
    console.log(`Step 2: Finding a '${paymentMethod}' payment method...`)
    const isCashPayment = paymentMethod === 'cash'
    const posConfig = await odooCall<OdooRecord[]>('pos.config', 'read', {
      ids: [configId],
      fields: ['payment_method_ids'],
    })

    if (!posConfig[0]?.payment_method_ids) {
      throw new Error(
        `Could not find payment methods on POS Config ID: ${configId}`,
      )
    }

    const paymentMethodIds = posConfig[0].payment_method_ids as number[]
    const paymentMethods = await odooCall<OdooRecord[]>(
      'pos.payment.method',
      'search_read',
      {
        domain: [
          ['id', 'in', paymentMethodIds],
          ['is_cash_count', '=', isCashPayment],
        ],
        fields: ['id', 'name'],
        limit: 1,
      },
    )

    if (!paymentMethods || paymentMethods.length === 0) {
      console.error(
        `No payment method found for type '${paymentMethod}' for the active POS session.`,
      )
      return NextResponse.json(
        { message: 'Could not find a suitable payment method.' },
        { status: 500 },
      )
    }
    const paymentMethodRecord = paymentMethods[0]
    const paymentMethodId = paymentMethodRecord.id as number
    console.log(
      `Using payment method: '${paymentMethodRecord.name}' (ID: ${paymentMethodId})`,
    )

    // 3. Find or create a customer (res.partner)
    console.log(
      `Step 3: Finding or creating customer for email: ${customer.email}`,
    )
    let partnerId: number | false = false
    const newPartnerPayload: Record<string, any> = {
      name: customer.name,
      email: customer.email,
    }

    if (orderType === 'delivery') {
      newPartnerPayload.street = customer.street
      newPartnerPayload.city = customer.city
      newPartnerPayload.zip = customer.zip
      // Assuming a default country, would need a lookup in a real app
      newPartnerPayload.country_id = customer.country ? 236 : false
    }

    if (customer.email) {
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
        console.log(`Found existing partner with ID: ${partnerId}`)
      } else {
        console.log('No existing partner found, creating a new one...')
        console.log('New partner payload:', newPartnerPayload)
        const newPartnerIds = await odooCall<number[]>(
          'res.partner',
          'create',
          {
            vals_list: [newPartnerPayload],
          },
        )
        if (!newPartnerIds || newPartnerIds.length === 0) {
          throw new Error('Partner creation did not return an ID.')
        }
        partnerId = newPartnerIds[0]
        console.log(`Created new partner with ID: ${partnerId}`)
      }
    }

    // 4. Prepare order lines and compute taxes server-side so Odoo receives proper amounts
    console.log(
      'Step 4: Preparing order lines and computing taxes server-side...',
    )

    // Fetch product tax relations for all products in the cart
    const productIds = Array.from(new Set(cartItems.map((i) => i.product_id)))
    const productsWithTaxes = await odooCall<Record<string, unknown>[]>(
      'product.product',
      'read',
      {
        ids: productIds,
        fields: ['id', 'taxes_id'],
      },
    )

    const taxIdMap: Record<number, number[]> = {}
    for (const prod of productsWithTaxes) {
      const p = prod as Record<string, unknown>
      const pid = Number(p.id as number)
      const taxes = Array.isArray(p.taxes_id) ? (p.taxes_id as number[]) : []
      taxIdMap[pid] = taxes || []
    }

    // Collect all tax ids used in this order and fetch tax records
    const allTaxIds = Array.from(new Set(Object.values(taxIdMap).flat()))
    const taxes: Record<string, unknown>[] =
      allTaxIds.length > 0
        ? await odooCall<Record<string, unknown>[]>('account.tax', 'read', {
            ids: allTaxIds,
            fields: ['id', 'amount', 'amount_type', 'price_include'],
          })
        : []
    const taxById: Record<number, Record<string, unknown>> = {}
    for (const t of taxes) {
      const tr = t as Record<string, unknown>
      taxById[Number(tr.id as number)] = tr
    }

    let computedAmountTax = 0
    let computedAmountTotal = 0

    const orderLines = cartItems.map((item) => {
      const qty = item.quantity
      const priceUnit = item.list_price
      const subtotal = priceUnit * qty

      // compute tax for this line by summing tax percentages
      const applicableTaxIds = taxIdMap[item.product_id] || []
      let lineTax = 0
      let priceExcl = subtotal

      for (const tid of applicableTaxIds) {
        const tx = taxById[tid]
        if (!tx) continue
        // handle percent taxes
        if (typeof tx.amount === 'number') {
          if (tx.price_include) {
            // If price_include=True, the tax is already in the unit price.
            // Remove it to get the pre-tax amount, then recalculate tax.
            // base = price / (1 + rate/100)
            const rate = tx.amount / 100
            priceExcl = priceExcl / (1 + rate)
            lineTax += priceExcl * rate
          } else {
            // If price_include=False, the tax is additive.
            lineTax += subtotal * (tx.amount / 100)
          }
        }
      }

      // For multiple taxes or mixed inclusion, round carefully
      lineTax = Number(lineTax.toFixed(2))
      priceExcl = Number(priceExcl.toFixed(2))
      const lineTotal = priceExcl + lineTax

      computedAmountTax += lineTax
      computedAmountTotal += lineTotal

      // Provide M2M assignment for tax_ids on the one2many line create
      const taxIdsCommand =
        applicableTaxIds.length > 0 ? [[6, 0, applicableTaxIds]] : []

      return [
        0,
        0,
        {
          product_id: item.product_id,
          qty,
          price_unit: priceUnit,
          price_subtotal: priceExcl,
          price_subtotal_incl: lineTotal,
          note: item.notes || '',
          tax_ids: taxIdsCommand,
        },
      ]
    })

    // If client provided a total, prefer server computed value to avoid mismatches
    const serverTotal = Number(computedAmountTotal.toFixed(2))

    const orderData = {
      name: `Web Order - ${orderType ? orderType.charAt(0).toUpperCase() + orderType.slice(1) : ''}`,
      session_id: sessionId,
      partner_id: partnerId,
      lines: orderLines,
      to_invoice: true,
      amount_tax: Number(computedAmountTax.toFixed(2)),
      amount_total: serverTotal,
      amount_paid: 0,
      amount_return: 0,
    }

    // 5. Create a DRAFT pos.order
    console.log('Step 5: Creating draft POS order...')

    const newOrderIds = await odooCall<number[]>('pos.order', 'create', {
      vals_list: [orderData],
    })

    if (!newOrderIds || newOrderIds.length === 0 || !newOrderIds[0]) {
      throw new Error("Odoo 'create' method did not return a new order ID.")
    }
    const newOrderId = newOrderIds[0]
    console.log(`--- Successfully created DRAFT order #${newOrderId} ---`)

    // 6. Use server-computed total for payment to avoid mismatches.
    const amountTotal = serverTotal
    console.log(
      `Step 6: Using server-computed total for payment is: ${amountTotal}`,
    )

    // 7. Add payment to the order
    console.log(`Step 7: Adding payment to order #${newOrderId}...`)
    // This creates the pos.payment record and links it.
    await odooCall<null>(ODOO_MODEL, 'add_payment', {
      ids: [newOrderId],
      data: {
        pos_order_id: newOrderId,
        amount: amountTotal,
        payment_method_id: paymentMethodId,
      },
    })
    console.log('Payment added successfully.')

    // 8. Validate the order to move it to "Paid" state
    console.log(`Step 8: Validating order #${newOrderId}...`)
    const validationResult = await odooCall<unknown>(
      ODOO_MODEL,
      'action_pos_order_paid',
      {
        ids: [newOrderId],
      },
    )
    console.log('Order validation result:', validationResult)

    // 9. Generate invoice for the order
    console.log(`Step 9: Generating invoice for order #${newOrderId}...`)
    try {
      const invoiceResult = await odooCall<unknown>(
        ODOO_MODEL,
        'action_pos_order_invoice',
        {
          ids: [newOrderId],
        },
      )
      console.log('Invoice generation result:', invoiceResult)
    } catch (invoiceError) {
      // Invoice generation is optional; log but don't fail the order
      const ie = invoiceError as Error
      console.warn('Warning: Invoice generation failed:', ie.message)
    }

    console.log(`--- Order #${newOrderId} successfully paid and validated! ---`)

    return NextResponse.json({
      success: true,
      orderId: newOrderId,
      message: `Order #${newOrderId} created and paid successfully!`,
    })
  } catch (error) {
    const e = error as Error
    const odooError = error as OdooClientError
    console.error('[API /restaurant/pos-orders POST] An error occurred:')
    if (odooError) {
      console.error('Status:', odooError.status)
      console.error('Message:', odooError.message)
      if (odooError.odooError) {
        console.error(
          'Odoo Error Details:',
          JSON.stringify(odooError.odooError, null, 2),
        )
      }
    } else {
      console.error('Message:', e.message)
    }

    return NextResponse.json(
      {
        message: odooError?.message || e.message,
        status: odooError?.status || 500,
        odooError: odooError?.odooError,
      },
      { status: odooError?.status || 500 },
    )
  }
}
