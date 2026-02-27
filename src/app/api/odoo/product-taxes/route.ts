import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export interface TaxInfo {
  id: number
  name: string
  amount: number
  amount_type: string
  price_include: boolean
}

export interface ProductTaxData {
  product_id: number
  taxes: TaxInfo[]
}

/**
 * GET /api/odoo/product-taxes?ids=1,2,3
 *
 * Fetches tax information for products to calculate tax-included prices.
 * This ensures frontend and backend show the same final amount to users.
 */
export async function GET(request: NextRequest) {
  try {
    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam) {
      return NextResponse.json(
        { message: 'Missing product ids parameter' },
        { status: 400 },
      )
    }

    const productIds = idsParam
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => !isNaN(id))

    if (productIds.length === 0) {
      return NextResponse.json(
        { message: 'No valid product ids provided' },
        { status: 400 },
      )
    }

    // Fetch products with their tax_ids
    const products = await odooCall<Record<string, unknown>[]>(
      'product.product',
      'read',
      {
        ids: productIds,
        fields: ['id', 'taxes_id'],
      },
    )

    // Collect all unique tax IDs
    const allTaxIds = Array.from(
      new Set(
        products.flatMap((p) => {
          const taxIds = p.taxes_id as number[] | undefined
          return Array.isArray(taxIds) ? taxIds : []
        }),
      ),
    )

    // Fetch tax details
    const taxDetails: TaxInfo[] =
      allTaxIds.length > 0
        ? await odooCall<TaxInfo[]>('account.tax', 'read', {
            ids: allTaxIds,
            fields: ['id', 'name', 'amount', 'amount_type', 'price_include'],
          })
        : []

    // Map taxes by ID for quick lookup
    const taxById: Record<number, TaxInfo> = {}
    for (const tax of taxDetails) {
      taxById[tax.id] = tax
    }

    // Build response with product-to-taxes mapping
    const result: ProductTaxData[] = products.map((product) => {
      const taxIds = Array.isArray(product.taxes_id)
        ? (product.taxes_id as number[])
        : []
      const applicableTaxes = taxIds
        .map((tid) => taxById[tid])
        .filter((tax): tax is TaxInfo => !!tax)

      return {
        product_id: product.id as number,
        taxes: applicableTaxes,
      }
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /product-taxes] Error:', odooError.message)
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
