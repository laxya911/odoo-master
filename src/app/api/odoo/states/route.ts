import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get('country_id');

    const domain: any[] = [];
    if (countryId) {
      domain.push(['country_id', '=', parseInt(countryId, 10)]);
    }

    const states = await odooCall<Array<{ id: number; name: string; code: string }>>('res.country.state', 'search_read', {
      domain: domain,
      fields: ['id', 'name', 'code'],
      order: 'name asc',
    });

    return NextResponse.json({ states });
  } catch (error) {
    console.error('Failed to fetch states:', error);
    return NextResponse.json({ error: 'Failed to fetch states' }, { status: 500 });
  }
}
