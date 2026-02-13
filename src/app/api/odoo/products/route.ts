import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { Product } from '@/lib/types';

export async function GET(request: NextRequest) {
  console.log(`[API /api/odoo/products] Received request with search params: ${request.nextUrl.searchParams.toString()}`);
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const name = searchParams.get('name');
    const active = searchParams.get('active');

    const domain: any[] = [];
    if (name) {
      domain.push(['name', 'ilike', name]);
    }
    if (active === 'true' || active === 'false') {
      domain.push(['active', '=', active === 'true']);
    }

    const total = await odooCall<number>('product.product', 'search_count', { domain });
    
    const records = await odooCall<Product[]>('product.product', 'search_read', {
      domain,
      fields: ['id', 'name', 'default_code', 'list_price', 'active'],
      limit,
      offset,
      order: 'id desc',
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
