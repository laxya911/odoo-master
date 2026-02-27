import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fulfillOdooOrder } from '@/lib/odoo-fulfillment';
import { odooCall } from '@/lib/odoo-client';
import { fromSmallestUnit, getCompanyCurrency } from '@/lib/odoo-order-utils';
import type { OrderPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('--- Received Stripe Webhook ---');
  try {
    // 1. Fetch active Stripe provider from Odoo to get keys
    const providers = await odooCall<any[]>('payment.provider', 'search_read', {
      domain: [['code', '=', 'stripe'], ['state', 'in', ['enabled', 'test']]],
      fields: ['id', 'stripe_secret_key', 'stripe_webhook_secret'],
    });

    if (!providers || providers.length === 0) {
      console.error('[API /payment/webhook] No active Stripe provider found in Odoo');
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    const providerRecord = providers[0];
    const stripeSecretKey = providerRecord.stripe_secret_key;
    const webhookSecret = providerRecord.stripe_webhook_secret;

    if (!stripeSecretKey || !webhookSecret) {
      console.error('[API /payment/webhook] Stripe credentials missing in Odoo config');
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[API /payment/webhook] No stripe-signature header found');
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log(`[API /payment/webhook] Event verified: ${event.id} type: ${event.type}`);
    } catch (err) {
      const error = err as Error;
      console.error(`[API /payment/webhook] Signature verification failed: ${error.message}`);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    // Single source of truth: we ONLY act on successful payment intents.
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      console.log(`💰 Payment Intent was successful! ID: ${paymentIntent.id}`);

      const metadata = paymentIntent.metadata;
      if (!metadata) {
          console.error('[API /payment/webhook] No metadata found in payment intent - cannot fulfill order.');
          return NextResponse.json({ received: true }); 
      }

      console.log('[API /payment/webhook] Metadata reconstructed:', metadata);

      // Reconstruct payload from trusted Stripe metadata we injected during payment intent creation.
      let lineItems = [];
      try {
        lineItems = JSON.parse(metadata.line_items || '[]');
      } catch (e) {
        console.error('[API /payment/webhook] Failed to parse line_items metadata:', e);
      }

      const currency = await getCompanyCurrency();
      const actualAmount = fromSmallestUnit(paymentIntent.amount, currency);

      const fulfillmentPayload: OrderPayload = {
        orderLines: lineItems.map((item: { p: number; q: number; note?: string }) => ({
          product_id: item.p,
          quantity: item.q,
          notes: item.note || '',
          list_price: 0 
        })),
        customer: {
          name: metadata.customer_name,
          email: metadata.customer_email,
          phone: metadata.customer_phone,
          street: metadata.street,
          city: metadata.city,
          zip: metadata.zip,
        },
        paymentMethod: 'stripe',
        orderType: (metadata.order_type as 'dine-in' | 'delivery' | 'takeout') || 'delivery',
        notes: metadata.notes,
        total: actualAmount
      };

      console.log('[API /payment/webhook] Final Fulfillment Payload:', JSON.stringify(fulfillmentPayload, null, 2));

      try {
        const result = await fulfillOdooOrder(fulfillmentPayload, paymentIntent.id);
        console.log('✅ Odoo Fulfillment Success:', result);
      } catch (fulfillError) {
        console.error('❌ Odoo Fulfillment Failed:', fulfillError);
        // We return 500 so Stripe retries if it's a transient failure
        return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
      }
    } else {
        console.log(`[API /payment/webhook] Ignored event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const err = error as Error;
    console.error('[API /payment/webhook] Unhandled server error:', err.message);
    return NextResponse.json({ error: 'Server processing error' }, { status: 500 });
  }
}
