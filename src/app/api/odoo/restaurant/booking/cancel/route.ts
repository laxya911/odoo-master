import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    
    // Support either query param or body
    const body = await req.json().catch(() => ({}))
    const finalToken = token || body.token

    const result = await odooCall<any>(
      'table.booking',
      'cancel_booking',
      { token: finalToken }
    )

    return NextResponse.json(result)
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /booking/cancel POST] Error:', odooError.message)
    return NextResponse.json(
      { status: 'error', message: odooError.message },
      { status: odooError.status || 500 }
    )
  }
}
