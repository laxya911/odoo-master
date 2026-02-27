import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { calculateOrderTotal, getCompanyCurrency, toSmallestUnit } from '@/lib/odoo-order-utils';
import { odooCall } from '@/lib/odoo-client';
import type { CreatePaymentRequest, OrderLineItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Fetch active Stripe provider from Odoo to get the secret key
    const providers = await odooCall<any[]>('payment.provider', 'search_read', {
      domain: [['code', '=', 'stripe'], ['state', 'in', ['enabled', 'test']]],
      fields: ['id', 'stripe_secret_key'],
    });

    if (!providers || providers.length === 0) {
      console.error('[API /payment/create] No active Stripe provider found in Odoo');
      return NextResponse.json({ error: 'Payment service configuration error' }, { status: 500 });
    }

    const stripeSecretKey = providers[0].stripe_secret_key;
    if (!stripeSecretKey) {
      console.error('[API /payment/create] Stripe secret key missing in Odoo config');
      return NextResponse.json({ error: 'Payment provider misconfigured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const body: CreatePaymentRequest = await req.json();

    if (!body.cart || !body.cart.items || body.cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // --- STRIPE CUSTOMER SYNC ---
    // Search for existing customer by email to maintain a single record per user
    let customerId: string | undefined;
    const existingCustomers = await stripe.customers.list({
      email: body.customer.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      // Update existing customer details to ensure accuracy
      await stripe.customers.update(customerId, {
        name: body.customer.name,
        phone: body.customer.phone,
        address: {
          line1: body.customer.street,
          city: body.customer.city,
          postal_code: body.customer.zip,
        }
      });
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
        }
      });
      customerId = newCustomer.id;
    }

    // 2. Prepare lines for server-side trusted calculation
    const orderLines: OrderLineItem[] = body.cart.items.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      list_price: item.product.list_price,
      notes: item.notes || ''
    }));

    // 3. Calculate true total server-side
    const { amount_total } = await calculateOrderTotal(orderLines);
    
    // 4. Fetch active currency code from Odoo
    const currency = await getCompanyCurrency();

    // 5. Convert to smallest unit (e.g. cents for USD, Yen for JPY)
    const amountInSmallestUnit = toSmallestUnit(amount_total, currency);

    // 6. Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency,
      customer: customerId, // Link Payment to the sync'd customer
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_id: body.cart_id || '',
        order_type: body.orderType,
        customer_name: body.customer.name,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone || '',
        street: body.customer.street || '',
        city: body.customer.city || '',
        zip: body.customer.zip || '',
        notes: body.notes || '',
        line_items: JSON.stringify(orderLines.map(l => ({
            p: l.product_id,
            q: l.quantity,
            note: l.notes || ''
        }))).slice(0, 500) // Keep <= 500 chars for Stripe limitations
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      provider: 'stripe'
    });

  } catch (error: unknown) {
    const err = error as { message: string };
    console.error('[API /payment/create] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
