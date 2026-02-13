import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { Partner } from '@/lib/types';

export async function GET(request: NextRequest) {
  console.log(`[API /api/odoo/partners] Received request with search params: ${request.nextUrl.searchParams.toString()}`);
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const query = searchParams.get('q');

    const domain: any[] = [];
    if (query) {
      domain.push('|', ['name', 'ilike', query], ['email', 'ilike', query]);
    }

    const total = await odooCall<number>('res.partner', 'search_count', { domain });
    
    const records = await odooCall<Partner[]>('res.partner', 'search_read', {
      domain,
      fields: ['id', 'name', 'email', 'phone', 'is_company'],
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
