import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';
import { OdooRecord, PosOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Find the partner
    const partners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
      domain: [['email', '=', email]],
      fields: ['id'],
      limit: 1,
    });

    if (!partners.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const partnerId = partners[0].id;

    // 2. Find the latest POS order for this partner
    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain: [['partner_id', '=', partnerId]],
      fields: ['id', 'pos_reference', 'state', 'date_order'],
      limit: 1,
      order: 'date_order desc',
    });

    if (!orders.length) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 });
    }

    return NextResponse.json(orders[0]);

  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
