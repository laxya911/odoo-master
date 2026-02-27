import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantProductDetails } from '@/lib/odoo-products'
import { OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const idParam = request.nextUrl.searchParams.get('id')
    if (!idParam) {
      return NextResponse.json(
        { message: 'Missing product id' },
        { status: 400 },
      )
    }
    const prodId = Number(idParam)

    const result = await getRestaurantProductDetails(prodId)

    if (!result) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 },
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /restaurant/product-details GET] Error:', odooError.message)
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
