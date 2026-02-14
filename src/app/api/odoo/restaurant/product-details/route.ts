import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

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

    // Read the product (product.product) with some useful fields including combo info
    const products = await odooCall<Record<string, unknown>[]>(
      'product.product',
      'read',
      {
        ids: [prodId],
        fields: [
          'id',
          'name',
          'list_price',
          'image_256',
          'product_tmpl_id',
          'attribute_value_ids',
        ],
      },
    )

    if (!products || products.length === 0) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 },
      )
    }

    const product = products[0]

    // Check if template has combo lines (pos.combo.line)
    let comboLines: Array<Record<string, unknown>> = []
    const tmpl = Array.isArray((product as any).product_tmpl_id)
      ? (product as any).product_tmpl_id[0]
      : (product as any).product_tmpl_id

    if (tmpl) {
      try {
        comboLines = await odooCall<Record<string, unknown>[]>(
          'pos.combo.line',
          'search_read',
          {
            domain: [['product_tmpl_id', '=', tmpl]],
            fields: [
              'id',
              'combo_category_id',
              'max_item',
              'included_item',
              'required',
            ],
          },
        )
      } catch (e) {
        // pos.combo.line may not exist in this Odoo instance; continue gracefully
      }
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 },
      )
    }

    const product = products[0]

    // Determine template id and fetch attribute lines
    const tmpl = Array.isArray(product.product_tmpl_id)
      ? product.product_tmpl_id[0]
      : product.product_tmpl_id

    const attributeLines: Array<Record<string, unknown>> = []
    if (tmpl) {
      const lines = await odooCall<Record<string, unknown>[]>(
        'product.template.attribute.line',
        'search_read',
        {
          domain: [['product_tmpl_id', '=', tmpl]],
          fields: ['id', 'attribute_id', 'value_ids'],
        },
      )
      attributeLines.push(...lines)
    }

    // For each attribute line, expand attribute name and values
    const attributes: Array<{
      id: number
      attribute?: { id: number; name: string } | null
      values: Array<{ id: number; name: string; price_extra?: number }>
    }> = []
    for (const line of attributeLines) {
      const attrId = Array.isArray((line as any).attribute_id)
        ? (line as any).attribute_id[0]
        : (line as any).attribute_id
      const attr = attrId
        ? await odooCall<Record<string, unknown>[]>(
            'product.attribute',
            'read',
            {
              ids: [attrId],
              fields: ['id', 'name'],
            },
          )
        : []
      const valueIds = Array.isArray((line as any).value_ids)
        ? (line as any).value_ids
        : []
      const values =
        valueIds.length > 0
          ? await odooCall<Record<string, unknown>[]>(
              'product.attribute.value',
              'read',
              { ids: valueIds, fields: ['id', 'name', 'price_extra'] },
            )
          : []
      attributes.push({
        id: (line as any).id,
        attribute: (attr as any)[0] || null,
        values: values as any,
      })
    }

    return NextResponse.json({ product, attributes, comboLines })
  } catch (error) {
    const odooError = error as OdooClientError
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
