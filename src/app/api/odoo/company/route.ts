import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const companies = await odooCall<any[]>('res.company', 'search_read', {
      domain: [],
      fields: ['id', 'name', 'email', 'phone', 'street', 'city', 'zip', 'logo', 'currency_id'],
      limit: 1,
    })

    if (!companies || companies.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const company = companies[0]

    // currency_id is returned as [id, name] e.g. [14, "JPY"]
    // Fetch full currency record to get symbol, decimal_places, position
    let currency = { name: 'USD', symbol: '$', decimal_places: 2, position: 'before' }
    const currencyId = Array.isArray(company.currency_id) ? company.currency_id[0] : null

    if (currencyId) {
      const currencies = await odooCall<any[]>('res.currency', 'read', {
        ids: [currencyId],
        fields: ['id', 'name', 'symbol', 'decimal_places', 'position'],
      })
      if (currencies && currencies.length > 0) {
        const cur = currencies[0]
        currency = {
          name: cur.name,
          symbol: cur.symbol,
          decimal_places: cur.decimal_places ?? 2,
          // Odoo uses 'before' or 'after' for currency position
          position: cur.position === 'after' ? 'after' : 'before',
        }
      }
    }

    return NextResponse.json({
      company: {
        ...company,
        currency,
      }
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /company GET] Error:', odooError.message)
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    )
  }
}
