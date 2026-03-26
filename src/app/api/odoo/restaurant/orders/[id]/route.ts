import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import { getSession } from '@/lib/auth'
import type { PosOrder } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    let domain: any[] = [['id', '=', id]]

    // If ID is not a number or doesn't match the original string (meaning it's a reference like 260-4-001 or Order-XXX)
    if (isNaN(id) || String(id) !== idStr) {
      domain = ['|', ['pos_reference', '=', idStr], ['name', '=', idStr]]
    }

    // 1. Fetch Order
    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain,
      fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'state', 'partner_id', 'lines', 'pos_reference', 'account_move', 'delivery_status'],
      limit: 1,
    })

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = orders[0]

    // 1.5 Security Check: Ensure order belongs to current user
    const session = await getSession();
    if (session && session.id) {
        // Get user's partner ID
        const users = await odooCall<any[]>('res.users', 'read', {
            ids: [session.id],
            fields: ['partner_id']
        });
        if (users && users.length > 0) {
            const userPartnerId = users[0].partner_id[0];
            if (order.partner_id && order.partner_id[0] !== userPartnerId) {
                console.warn(`[API /restaurant/orders/${idStr}] Unauthorized access attempt by user ${session.id} for order ${id}`);
                return NextResponse.json({ error: 'Unauthorized access to this order' }, { status: 403 });
            }
        }
    } else {
        // If not logged in, we only allow access if the order doesn't have a partner (unlikely for POS)
        // or if we decide to fully block it. User mentioned it should be protected.
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 2. Fetch Order Lines
    const lineIds = order.lines as number[]
    const lines = await odooCall<any[]>('pos.order.line', 'read', {
      ids: lineIds,
      fields: ['id', 'product_id', 'full_product_name', 'qty', 'price_unit', 'price_subtotal', 'price_subtotal_incl', 'note', 'customer_note'],
    })

    // 3. Get Partner details for address
    let partner = null
    if (order.partner_id) {
        const partners = await odooCall<any[]>('res.partner', 'read', {
            ids: [order.partner_id[0]],
            fields: ['id', 'name', 'street', 'city', 'zip', 'phone', 'email']
        })
        if (partners && partners.length > 0) {
            partner = partners[0]
        }
    }

    return NextResponse.json({
      order: {
        ...order,
        line_items: lines,
        partner_detail: partner
      }
    })
  } catch (error) {
    const odooError = error as OdooClientError
    const { id: idStr } = await params
    console.error(`[API /restaurant/orders/${idStr} GET] Error:`, odooError.message)
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    )
  }
}
