import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantProducts } from '@/lib/odoo-products';
import { OdooClientError } from '@/lib/odoo-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const query = searchParams.get('q') || undefined;

    const result = await getRestaurantProducts({ limit, offset, query });

    return NextResponse.json(result);
  } catch (error) {
    const odooError = error as OdooClientError;
    console.error('[API /restaurant/products GET] Error:', odooError.message);
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
