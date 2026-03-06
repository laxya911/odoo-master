import { NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const countries = await odooCall<Array<{ id: number; name: string }>>('res.country', 'search_read', {
      domain: [],
      fields: ['id', 'name'],
      order: 'name asc',
    });

    return NextResponse.json({ countries });
  } catch (error) {
    console.error('Failed to fetch countries:', error);
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 });
  }
}
