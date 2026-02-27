import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
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

    const domain: Array<unknown> = []
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

