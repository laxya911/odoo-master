import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import { getSession } from '@/lib/auth'
import type { OdooRecord, OrderPayload } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ODOO_MODEL = 'pos.order'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sessionId = searchParams.get('session_id')
    const email = searchParams.get('email')
    const name = searchParams.get('name')

    const domain: Array<unknown> = []

    // Security Filter: Always restrict to current user's partner
    const session = await getSession();
    if (session && session.id) {
        const users = await odooCall<any[]>('res.users', 'read', {
            ids: [session.id],
            fields: ['partner_id']
        });
        if (users && users.length > 0) {
            const partnerId = users[0].partner_id[0];
            domain.push(['partner_id', '=', partnerId]);
        }
    } else {
        // If not logged in, we only allow searching by specific email/name if provided,
        // but even then, it's better to limit it. 
        // For now, if no session, we require email to find "their" guest orders.
        if (!email && !name) {
            return NextResponse.json({ data: [], meta: { total: 0 } });
        }
    }

    if (startDate) {
      domain.push(['date_order', '>=', `${startDate} 00:00:00`])
    }
    if (endDate) {
      domain.push(['date_order', '<=', `${endDate} 23:59:59`])
    }
    if (sessionId) {
      domain.push(['session_id', '=', Number(sessionId)])
    }
    if (email) {
      domain.push(['partner_id.email', '=', email])
    }
    if (name) {
      domain.push(['name', 'ilike', name])
    }

    const fieldsDef = await odooCall<Record<string, unknown>>(
      ODOO_MODEL,
      'fields_get',
      {},
    )
    const fieldNames = Object.keys(fieldsDef)

    const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain })

    const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
      domain,
      fields: fieldNames,
      limit,
      offset,
      order: 'date_order desc',
    })

    return NextResponse.json({
      data: records,
      meta: { total, limit, offset, model: ODOO_MODEL, domain },
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error(
      '[API /restaurant/pos-orders GET] Odoo Error:',
      odooError.odooError || odooError.message,
    )
    return NextResponse.json(
      {
        message: odooError.message,
        status: odooError.status,
        odooError: odooError.odooError,
      },
      { status: odooError.status || 500 },
    )
  }
}

