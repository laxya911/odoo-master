import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pos_config_id } = body

    const result = await odooCall<any>(
      'table.booking.config',
      'get_booking_config',
      { pos_config_id }
    )

    return NextResponse.json(result)
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /booking/config POST] Error:', odooError.message)
    return NextResponse.json(
      { status: 'error', message: odooError.message },
      { status: odooError.status || 500 }
    )
  }
}
