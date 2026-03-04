import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  calculateOrderTotal,
  getCompanyCurrency,
  toSmallestUnit,
} from '@/lib/odoo-order-utils'
import { odooCall } from '@/lib/odoo-client'
import type { CreatePaymentRequest, OrderLineItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Fetch active Stripe provider from Odoo to get the secret key
    const providers = await odooCall<any[]>('payment.provider', 'search_read', {
      domain: [
        ['code', '=', 'stripe'],
        ['state', 'in', ['enabled', 'test']],
      ],
      fields: ['id', 'stripe_secret_key'],
    })

    if (!providers || providers.length === 0) {
      console.error(
        '[API /payment/create] No active Stripe provider found in Odoo',
      )
      return NextResponse.json(
        { error: 'Payment service configuration error' },
        { status: 500 },
      )
    }

    const stripeSecretKey = providers[0].stripe_secret_key
    if (!stripeSecretKey) {
      console.error(
        '[API /payment/create] Stripe secret key missing in Odoo config',
      )
      return NextResponse.json(
        { error: 'Payment provider misconfigured' },
        { status: 500 },
      )
    }

    const stripe = new Stripe(stripeSecretKey)
    const body: CreatePaymentRequest = await req.json()

    if (!body.cart || !body.cart.items || body.cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // --- STRIPE CUSTOMER SYNC ---
    // Search for existing customer by email to maintain a single record per user
    let customerId: string | undefined
    const existingCustomers = await stripe.customers.list({
      email: body.customer.email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
      // Update existing customer details to ensure accuracy
      await stripe.customers.update(customerId, {
        name: body.customer.name,
        phone: body.customer.phone,
        address: {
          line1: body.customer.street,
          city: body.customer.city,
          postal_code: body.customer.zip,
        },
      })
    } else {
      // Create new customer if not found
      const newCustomer = await stripe.customers.create({
        email: body.customer.email,
        name: body.customer.name,
        phone: body.customer.phone,
        address: {
          line1: body.customer.street,
          city: body.customer.city,
          postal_code: body.customer.zip,
        },
      })
      customerId = newCustomer.id
    }

    // 2. Prepare lines for server-side trusted calculation
    // Expanding combos into parent/child lines to get accurate total
    const { expandCartItems } = await import('@/lib/odoo-order-utils')
    const orderLines = expandCartItems(body.cart.items)

    // 3. Calculate true total server-side
    const { amount_total } = await calculateOrderTotal(orderLines)

    // 4. Fetch active currency code from Odoo
    const currency = await getCompanyCurrency()

    // 5. Convert to smallest unit (e.g. cents for USD, Yen for JPY)
    const amountInSmallestUnit = toSmallestUnit(amount_total, currency)

    // 6. Create PaymentIntent
    // Webhook needs to reconstruct the EXACT same expanded lines.
    // We store the expanded lines directly to avoid mismatch between frontend cart
    // representations (which include tax) and backend expected base prices.

    // Limit to essentials to fit in Stripe metadata limits
    const { lines: processedLines } = await calculateOrderTotal(orderLines)

    const compactItems = processedLines.map((line) => ({
      p: line.product_id,
      q: line.quantity,
      pr: line.list_price, // Exclusive base
      pri: line.price_unit_incl, // TRUE targeted inclusive price
      t: line.tax_ids, // Correctly mapped tax IDs (including fallback)
      n: line.customer_note || '',
      c: line.combo_id,
      ci: line.combo_item_id,
      a: line.attribute_value_ids,
    }))

    // Build a compact string like "pid,q,pr;pid2,q2,pr2;..." for reliable metadata storage
    const compactString = compactItems
      .map((ci) => {
        const parts = [ci.p, ci.q, Math.round(ci.pr * 100)]
        return parts.join(',')
      })
      .join(';')

    // 6. Create Stripe Metadata (Chunked to avoid limit issues)
    const metadata: Record<string, string> = {
      cart_id: body.cart_id || '',
      order_type: body.orderType,
      customer_name: body.customer.name,
      customer_email: body.customer.email,
      customer_phone: body.customer.phone || '',
      street: body.customer.street || '',
      city: body.customer.city || '',
      zip: body.customer.zip || '',
      notes: body.customer_note || '',
      line_count: compactItems.length.toString(),
    }

    // Add each line as its own metadata key to avoid 500-char limit truncation
    compactItems.forEach((item, index) => {
      metadata[`line_${index}`] = JSON.stringify(item)
    })

    // Fallback for very basic tracking (legacy)
    metadata.line_items_str = compactString.slice(0, 500)

    let paymentIntent

    if (body.paymentIntentId) {
      try {
        paymentIntent = await stripe.paymentIntents.update(body.paymentIntentId, {
          amount: amountInSmallestUnit,
          currency: currency,
          metadata: metadata,
          customer: customerId,
        })
      } catch (updateErr: any) {
        console.warn(`[API /payment/create] Failed to update PaymentIntent ${body.paymentIntentId}, creating new one instead. Error: ${updateErr.message}`)
        paymentIntent = await stripe.paymentIntents.create({
          amount: amountInSmallestUnit,
          currency: currency,
          customer: customerId,
          automatic_payment_methods: { enabled: true },
          metadata: metadata,
        })
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInSmallestUnit,
        currency: currency,
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: metadata,
      })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      provider: 'stripe',
    })
  } catch (error: unknown) {
    const err = error as { message: string }
    console.error('[API /payment/create] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
