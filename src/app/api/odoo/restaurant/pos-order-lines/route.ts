import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { OdooRecord } from '@/lib/types';

const ODOO_MODEL = "pos.order.line";

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '80', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const orderIdsParam = searchParams.get('order_ids');

    const domain: any[] = [];

    if (orderIdsParam) {
      const orderIds = orderIdsParam.split(',').map(Number);
      if (orderIds.length > 0) {
        domain.push(['order_id', 'in', orderIds]);
      }
    } else {
      // Don't fetch all lines if no orders are specified
      return NextResponse.json({ data: [], meta: { total: 0, limit, offset, model: ODOO_MODEL, domain: [] } });
    }

    const fieldsDef = await odooCall<Record<string, any>>(ODOO_MODEL, 'fields_get', {});
    const fieldNames = Object.keys(fieldsDef);
    
    const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain });
    
    const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
      domain,
      fields: fieldNames,
      limit,
      offset,
      order: 'id desc',
    });

    return NextResponse.json({ 
      data: records, 
      meta: { total, limit, offset, model: ODOO_MODEL, domain }
    });

  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
