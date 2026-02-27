import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { PosOrder } from '@/lib/types';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    const domain: unknown[] = [];
    if (startDate) {
      domain.push(['date_order', '>=', startDate]);
    }
    if (endDate) {
      domain.push(['date_order', '<=', endDate]);
    }

    const total = await odooCall<number>('pos.order', 'search_count', { domain });
    
    const records = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain,
      fields: ['id', 'name', 'date_order', 'partner_id', 'amount_total', 'state', 'session_id'],
      limit,
      offset,
      order: 'date_order desc',
    });

    return NextResponse.json({ data: records, meta: { total, limit, offset } });
  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { error: { message: odooError.message, status: odooError.status } },
      { status: odooError.status || 500 }
    );
  }
}
