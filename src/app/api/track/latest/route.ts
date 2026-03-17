import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';
import { logToFile } from '@/lib/debug-logger';
import { OdooRecord, PosOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');
    const createdAfter = searchParams.get('created_after');

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
    const domain: any[] = [['partner_id', '=', partnerId]];
    if (createdAfter) {
      // Subtract 120 seconds to account for clock drift between server/client
      const baseDate = new Date(createdAfter.replace(' ', 'T') + 'Z'); // Convert to ISO-like for JS
      const bufferedDate = new Date(baseDate.getTime() - 120 * 1000);
      const pad = (num: number) => num.toString().padStart(2, '0');
      const bufferedTimestamp = `${bufferedDate.getUTCFullYear()}-${pad(bufferedDate.getUTCMonth() + 1)}-${pad(bufferedDate.getUTCDate())} ${pad(bufferedDate.getUTCHours())}:${pad(bufferedDate.getUTCMinutes())}:${pad(bufferedDate.getUTCSeconds())}`;
      
      domain.push(['date_order', '>=', bufferedTimestamp]);
      logToFile(`[latest-poll] Querying after buffered timestamp: ${bufferedTimestamp} (Original: ${createdAfter})`);
    }

    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain: domain,
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
