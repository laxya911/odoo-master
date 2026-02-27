import { NextResponse } from 'next/server';
import { getCompanyCurrency } from '@/lib/odoo-order-utils';
import { odooCall } from '@/lib/odoo-client';
import type { PaymentConfigResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch active Stripe provider from Odoo
    const providers = await odooCall<any[]>('payment.provider', 'search_read', {
      domain: [['code', '=', 'stripe'], ['state', 'in', ['enabled', 'test']]],
      fields: ['id', 'stripe_publishable_key'],
    });

    if (!providers || providers.length === 0) {
      console.warn('[API /payment/config] No active Stripe provider found in Odoo');
      return NextResponse.json({ error: 'No payment provider configured' }, { status: 500 });
    }

    const providerRecord = providers[0];
    const publishableKey = providerRecord.stripe_publishable_key;

    if (!publishableKey) {
      console.error('[API /payment/config] Stripe publishable key missing in Odoo config');
      return NextResponse.json({ error: 'Payment provider misconfigured' }, { status: 500 });
    }

    const currency = await getCompanyCurrency();

    const config: PaymentConfigResponse = {
      provider: 'stripe',
      public_key: publishableKey,
      currency: currency,
    };

    return NextResponse.json(config);

  } catch (error) {
    console.error('[API /payment/config] error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment configuration' }, { status: 500 });
  }
}
