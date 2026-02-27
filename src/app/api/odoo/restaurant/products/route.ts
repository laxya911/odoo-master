import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { OdooRecord } from '@/lib/types';

const ODOO_MODEL = "product.product";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const query = searchParams.get('q');

    // Fetch POS products that are available for sale
    // Exclude tips-type products (no pos category or named 'Tips'/'Tip')
    const domain: any[] = [
      ['sale_ok', '=', true],
      ['available_in_pos', '=', true],
      ['name', 'not ilike', 'tip'],   // filter out tip/tips products
    ];
    if (query) {
      domain.push(['name', 'ilike', query]);
    }

    const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain });
    
    const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
      domain,
      fields: [
        'id', 'name', 'list_price', 'image_256',
        'product_tmpl_id', 'attribute_line_ids',
        'pos_categ_ids', 'taxes_id', 'combo_ids',
        'description_sale', 'product_tag_ids',
        'available_in_pos',
      ],
      limit,
      offset,
      order: 'name asc',
    });

    // --- Fetch POS Categories ---
    const allCategoryIds = [
      ...new Set(records.flatMap((r: OdooRecord) => (r.pos_categ_ids as number[]) || [])),
    ];

    let categories: OdooRecord[] = [];
    if (allCategoryIds.length > 0) {
      categories = await odooCall<OdooRecord[]>('pos.category', 'read', {
        ids: allCategoryIds,
        fields: ['id', 'name', 'sequence', 'parent_id'],
      });
    }

    // --- Fetch Product Tags ---
    const allTagIds = [
      ...new Set(records.flatMap((r: OdooRecord) => (r.product_tag_ids as number[]) || [])),
    ];

    let tagsArray: OdooRecord[] = [];
    if (allTagIds.length > 0) {
      tagsArray = await odooCall<OdooRecord[]>('product.tag', 'read', {
        ids: allTagIds,
        fields: ['id', 'name', 'color'],
      });
    }

    const tags: Record<number, { id: number; name: string; color?: number }> = {};
    for (const t of tagsArray) {
      tags[t.id as number] = { id: t.id as number, name: t.name as string, color: t.color as number };
    }

    return NextResponse.json({ 
      data: records, 
      meta: { 
        total, limit, offset, 
        model: ODOO_MODEL, 
        domain,
        categories,
        tags,
      }
    });

  } catch (error) {
    const odooError = error as OdooClientError;
    console.error('[API /restaurant/products GET] Error:', odooError.message);
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
