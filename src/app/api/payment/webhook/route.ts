import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { fulfillOdooOrder } from '@/lib/odoo-fulfillment'
import { odooCall } from '@/lib/odoo-client'
import { fromSmallestUnit, getCompanyCurrency } from '@/lib/odoo-order-utils'
import type { OrderPayload, OrderLineItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  console.log('--- RECEIVED STRIPE WEBHOOK PING ---')
  console.log('Target URL: /api/payment/webhook')
  try {
    // 1. Fetch active Stripe provider from Odoo to get keys
    let providers: any[] = []
    try {
      providers = await odooCall<any[]>('payment.provider', 'search_read', {
        domain: [
          ['code', '=', 'stripe'],
          ['state', 'in', ['enabled', 'test']],
        ],
        fields: ['id', 'stripe_secret_key', 'stripe_webhook_secret'],
      })
    } catch (e) {
      console.error(
        '[API /payment/webhook] FAILED to fetch Stripe credentials from Odoo. Check ODOO_API_KEY and connection.',
        e,
      )
      return NextResponse.json(
        { error: 'Internal connection error' },
        { status: 500 },
      )
    }

    if (!providers || providers.length === 0) {
      console.error(
        '[API /payment/webhook] No active Stripe provider found in Odoo',
      )
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const providerRecord = providers[0]
    const stripeSecretKey = providerRecord.stripe_secret_key
    const webhookSecret = providerRecord.stripe_webhook_secret

    if (!stripeSecretKey || !webhookSecret) {
      console.error(
        '[API /payment/webhook] Stripe credentials missing in Odoo config',
      )
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const stripe = new Stripe(stripeSecretKey)
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    console.log(
      `[API /payment/webhook] Body length: ${body.length}, Signature present: ${!!signature}`,
    )

    if (!signature) {
      console.error('[API /payment/webhook] No stripe-signature header found')
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 },
      )
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log(
        `[API /payment/webhook] Event verified: ${event.id} type: ${event.type}`,
      )
    } catch (err) {
      const error = err as Error
      console.error(
        `[API /payment/webhook] Signature verification failed: ${error.message}`,
      )
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 400 },
      )
    }

    // Single source of truth: we ONLY act on successful payment intents.
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      console.log(`💰 [Webhook] Payment Intent Succeeded: ${paymentIntent.id}`)
      console.log(
        `💰 [Webhook] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`,
      )

      const metadata = paymentIntent.metadata || {}
      // Prefer structured JSON if present; otherwise fall back to compact string variant
      let compactItems: any[] = []
      if (metadata.line_items) {
        try {
          compactItems = JSON.parse(metadata.line_items as string)
          console.log(
            `📦 [Webhook] Parsed ${compactItems.length} base items from metadata.line_items.`,
          )
        } catch (e) {
          console.warn(
            '❌ [Webhook] Failed to parse metadata.line_items JSON, will attempt fallback parsing.',
            e,
          )
        }
      }

      if (
        (!compactItems || compactItems.length === 0) &&
        metadata.line_items_str
      ) {
        // Parse fallback compact string: "pid,q,pr;pid2,q2,pr2"
        try {
          const parts = (metadata.line_items_str as string)
            .split(';')
            .filter(Boolean)
          compactItems = parts.map((p) => {
            const [pid, q, prCents] = p.split(',')
            return { p: Number(pid), q: Number(q), pr: Number(prCents) / 100 }
          })
          console.log(
            `📦 [Webhook] Parsed ${compactItems.length} base items from metadata.line_items_str.`,
          )
        } catch (e) {
          console.error(
            '❌ [Webhook] Failed to parse fallback line_items_str metadata.',
            e,
          )
          return NextResponse.json(
            { error: 'Metadata parse error.' },
            { status: 400 },
          )
        }
      }

      if (!compactItems || compactItems.length === 0) {
        console.error(
          '❌ [Webhook] FATAL: No metadata line items found in payment intent. Cannot fulfill order.',
        )
        return NextResponse.json({ received: true })
      }

      const orderLines: OrderLineItem[] = []
      const currency = await getCompanyCurrency()
      const actualAmount = fromSmallestUnit(paymentIntent.amount, currency)

      for (const item of compactItems) {
        let subItemTotalExtra = 0
        const childLines: OrderLineItem[] = []

        if (item.s && Array.isArray(item.s)) {
          for (const s of item.s) {
            const comboLineId = s.l
            const itemIds = s.i || []
            const productIds = s.p || []
            const prices = s.e || []
            const qtyFree = (s as any).q_f || 0

            // Process items in selection order (index-based) so free quota applies correctly
            for (let i = 0; i < itemIds.length; i++) {
              const ciid = itemIds[i]
              const pid = productIds[i]
              const price = prices[i] || 0

              // Items at index < qtyFree are free (list_price=0), rest are paid
              let linePrice = 0
              if (i >= qtyFree) {
                // Beyond free quota - charge the full price
                linePrice = price
                subItemTotalExtra += linePrice
              }
              // else: item is free (linePrice stays 0)

              childLines.push({
                product_id: pid,
                quantity: item.q,
                list_price: linePrice,
                combo_id: item.p,
                combo_line_id: comboLineId,
                combo_item_id: ciid,
                notes: '',
              })
            }
          }
        }

        // Add parent line (Base Price = Total Item Price - Sub-item Extras)
        orderLines.push({
          product_id: item.p,
          quantity: item.q,
          list_price: Math.max(0, item.pr - subItemTotalExtra),
          notes: item.n || '',
        })
        // Add child lines
        orderLines.push(...childLines)
      }

      const fulfillmentPayload: OrderPayload = {
        orderLines,
        customer: {
          name: metadata.customer_name || '',
          email: metadata.customer_email || '',
          phone: metadata.customer_phone || '',
          street: metadata.street || '',
          city: metadata.city || '',
          zip: metadata.zip || '',
        },
        paymentMethod: 'stripe',
        orderType:
          (metadata.order_type as 'dine-in' | 'delivery' | 'takeout') ||
          'delivery',
        notes: metadata.notes || '',
        total: actualAmount,
      }

      console.log('🚀 [Webhook] Triggering Odoo Fulfillment...')
      console.log(
        '[Webhook] Fulfillment Payload:',
        JSON.stringify(fulfillmentPayload, null, 2),
      )
      try {
        const result = await fulfillOdooOrder(
          fulfillmentPayload,
          paymentIntent.id,
        )
        console.log('✅ [Webhook] Fulfillment SUCCESS:', result.posReference)
      } catch (fulfillError) {
        const err = fulfillError as any
        console.error('❌ [Webhook] Fulfillment FAILED:', err.message)
        console.error('❌ [Webhook] Full Error:', err)
        if (err.stack) console.error('❌ [Webhook] Stack:', err.stack)
        // attempt to refund the charge since we couldn't create the order
        try {
          console.log(
            '[Webhook] Initiating refund due to fulfillment failure...',
          )
          await stripe.refunds.create({ payment_intent: paymentIntent.id })
          console.log('[Webhook] Refund created successfully.')
        } catch (refundErr) {
          console.error('[Webhook] Refund attempt failed:', refundErr)
        }
        // Return 500 so Stripe may still retry if it deems necessary;
        // we already queued a refund which protects the customer.
        return NextResponse.json(
          { error: `Fulfillment failed: ${err.message}` },
          { status: 500 },
        )
      }
    } else {
      console.log(`[Webhook] Ignored event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const err = error as any
    console.error('❌ [Webhook] Critical internal error:', err.message)
    console.error('❌ [Webhook] Full Error:', err)
    if (err.stack) console.error('❌ [Webhook] Stack:', err.stack)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
