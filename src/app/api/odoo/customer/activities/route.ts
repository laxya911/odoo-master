import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ status: 'error', message: 'Email is required' }, { status: 400 })
    }

    const result = await odooCall<any>(
      'table.booking',
      'get_customer_activities',
      { email }
    )

    return NextResponse.json(result)
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /customer/activities GET] Error:', odooError.message)
    return NextResponse.json(
      { status: 'error', message: odooError.message },
      { status: odooError.status || 500 }
    )
  }
}
