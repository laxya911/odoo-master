import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { Partner, PosOrder } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const id = searchParams.get('id')

    if (!email && !id) {
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

    const domain: any[] = partnerId ? [['id', '=', partnerId]] : [['email', '=', email]]
    const partners = await odooCall<Partner[]>('res.partner', 'search_read', {
      domain,
      fields: ['id', 'name', 'email', 'phone', 'street', 'city', 'zip', 'image_1920'],
      limit: 1,
    })

    if (!partners || partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const partner = partners[0]

    // 2. Fetch Recent Orders
    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain: [['partner_id', '=', partner.id]],
      fields: ['id', 'name', 'date_order', 'amount_total', 'state'],
      limit: 5,
      order: 'date_order desc',
    })

    return NextResponse.json({
      partner,
      recentOrders: orders,
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /restaurant/profile GET] Error:', odooError.message)
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    )
  }
}
