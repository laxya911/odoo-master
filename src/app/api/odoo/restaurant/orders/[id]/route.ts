import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { PosOrder } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    // 1. Fetch Order
    const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
      domain: [['id', '=', id]],
      fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'state', 'partner_id', 'lines', 'pos_reference'],
      limit: 1,
    })

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = orders[0]

    // 2. Fetch Order Lines
    const lineIds = order.lines as number[]
    const lines = await odooCall<any[]>('pos.order.line', 'read', {
      ids: lineIds,
      fields: ['id', 'product_id', 'qty', 'price_unit', 'price_subtotal', 'price_subtotal_incl', 'note'],
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
