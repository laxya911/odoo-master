import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Payload should match Odoo's create_booking params
    const result = await odooCall<any>(
      'table.booking',
      'create_booking',
      body
    )

    return NextResponse.json(result)
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /booking/create POST] Error:', odooError.message)
    return NextResponse.json(
      { status: 'error', message: odooError.message },
      { status: odooError.status || 500 }
    )
  }
}
