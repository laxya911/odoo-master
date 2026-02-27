import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { PosOrder } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const id = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if ((!email || email === 'undefined') && !id) {
      return NextResponse.json({ error: 'Email or ID is required' }, { status: 400 })
    }

    // 1. Resolve Partner ID from User ID or Email
    let partnerId: number | null = null;
    
    if (id) {
        const users = await odooCall<any[]>('res.users', 'read', {
            ids: [parseInt(id, 10)],
            fields: ['partner_id']
        });
        if (users && users.length > 0) {
            partnerId = users[0].partner_id[0];
        } else {
            // Fallback: search as partner id
            partnerId = parseInt(id, 10);
        }
    }

    if (!partnerId && (!email || email === 'undefined')) {
        return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const domain: any[] = partnerId ? [['id', '=', partnerId]] : [['email', '=', email]]
    const partners = await odooCall<any[]>('res.partner', 'search_read', {
      domain,
      fields: ['id'],
      limit: 1,
    })

    if (!partners || partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const resolvedPartnerId = partners[0].id

    // 2. Fetch Orders
    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain: [['partner_id', '=', resolvedPartnerId]],
      fields: ['id', 'name', 'date_order', 'amount_total', 'state'],
      limit,
      offset,
      order: 'date_order desc',
    })

    const total = await odooCall<number>('pos.order', 'search_count', {
      domain: [['partner_id', '=', resolvedPartnerId]],
    })

    return NextResponse.json({
      data: orders,
      meta: { total, limit, offset }
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /restaurant/orders/history GET] Error:', odooError.message)
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    )
  }
}
