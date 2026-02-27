import { NextRequest, NextResponse } from 'next/server'
import { odooCall } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const providers = await odooCall<any[]>('payment.provider', 'search_read', {
      domain: [['code', '=', 'stripe']],
      fields: ['id', 'name', 'code', 'state', 'stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret']
    })
    return NextResponse.json(providers)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
