import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export interface AttributeValue {
  id: number
  name: string
  price_extra?: number
}

export interface AttributeLine {
  id: number
  attribute?: { id: number; name: string } | null
  values: AttributeValue[]
}

export interface ComboLine {
  id: number
  combo_category_id?: [number, string] | string | null
  max_item?: number
  included_item?: number
  required?: boolean
  products?: Array<{ id: number; name: string; list_price: number }>
}

export interface ProductDetails {
  product?: Record<string, unknown>
  attributes?: AttributeLine[]
  comboLines?: ComboLine[]
  taxes?: Array<{
    id: number
    name: string
    amount: number
    price_include: boolean
  }>
}

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
          'attribute_line_ids',
          'taxes_id',
        ],
      },
    )

    if (!products || products.length === 0) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 },
      )
    }

    const product = products[0] as Record<string, unknown>
    const tmplId = (
      product.product_tmpl_id as [number, string] | undefined
    )?.[0]

    const attributeLines: AttributeLine[] = []
    if (
      tmplId &&
      Array.isArray(product.attribute_line_ids) &&
      product.attribute_line_ids?.length > 0
    ) {
      const lines = await odooCall<Record<string, unknown>[]>(
        'product.template.attribute.line',
        'search_read',
        {
          domain: [['product_tmpl_id', '=', tmplId]],
          fields: ['id', 'attribute_id', 'value_ids'],
        },
      )

      for (const line of lines as Record<string, unknown>[]) {
        const attrId = (line.attribute_id as [number, string] | undefined)?.[0]
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

        const valueIds = (line.value_ids as number[] | undefined) || []
        const values: AttributeValue[] =
          valueIds.length > 0
            ? await odooCall<AttributeValue[]>(
                'product.attribute.value',
                'read',
                {
                  ids: valueIds,
                  fields: ['id', 'name'],
                },
              )
            : []

        const attrData = attr[0] as Record<string, unknown> | undefined
        attributeLines.push({
          id: (line.id as number) || 0,
          attribute: attrData
            ? {
                id: (attrData.id as number) || 0,
                name: (attrData.name as string) || '',
              }
            : null,
          values,
        })
      }
    }

    const comboLines: ComboLine[] = []
    if (tmplId) {
      const templates = await odooCall<Record<string, unknown>[]>(
        'product.template',
        'read',
        {
          ids: [tmplId],
          fields: ['combo_ids'],
        },
      )

      const comboIds = (templates[0]?.combo_ids as number[] | undefined) || []

      if (Array.isArray(comboIds) && comboIds.length > 0) {
        const combos = await odooCall<Record<string, unknown>[]>(
          'product.combo',
          'read',
          {
            ids: comboIds,
            fields: ['id'],
          },
        )

        const comboItems = await odooCall<Record<string, unknown>[]>(
          'product.combo.item',
          'search_read',
          {
            domain: [['combo_id', 'in', comboIds]],
            fields: ['combo_id', 'product_id'],
          },
        )

        const productsByComboId: Record<number, number[]> = {}
        for (const item of comboItems) {
          const comboId =
            (item.combo_id as [number, string] | undefined)?.[0] || 0
          const productId =
            (item.product_id as [number, string] | undefined)?.[0] || 0
          if (!productsByComboId[comboId]) {
            productsByComboId[comboId] = []
          }
          productsByComboId[comboId].push(productId)
        }

        const allProductIds = [
          ...new Set(Object.values(productsByComboId).flat()),
        ]

        const productDetailsMap: Record<
          number,
          { id: number; name: string; list_price: number }
        > = {}
        if (allProductIds.length > 0) {
          const productsData = await odooCall<Record<string, unknown>[]>(
            'product.product',
            'read',
            {
              ids: allProductIds,
              fields: ['id', 'name', 'list_price'],
            },
          )
          for (const p of productsData) {
            const pid = (p.id as number) || 0
            productDetailsMap[pid] = {
              id: pid,
              name: (p.name as string) || '',
              list_price: (p.list_price as number) || 0,
            }
          }
        }

        for (const combo of combos) {
          const comboId = (combo.id as number) || 0
          const productIdsForCombo = productsByComboId[comboId] || []
          const productsList = productIdsForCombo
            .map((pid: number) => productDetailsMap[pid])
            .filter(Boolean)

          comboLines.push({
            id: comboId,
            combo_category_id: (combo as Record<string, unknown>)
              .combo_category_id as
              | string
              | [number, string]
              | null
              | undefined,
            max_item: ((combo as Record<string, unknown>).max_item ||
              1) as number,
            included_item: 0, // Assuming 0 as the field is not available
            required: false, // Assuming false as the field is not available
            products: productsList,
          })
        }
      }
    }

    // Fetch tax details for the product
    let productTaxes: Array<{
      id: number
      name: string
      amount: number
      price_include: boolean
    }> = []
    if (
      product.taxes_id &&
      Array.isArray(product.taxes_id) &&
      product.taxes_id.length > 0
    ) {
      const taxIds = product.taxes_id as number[]
      const taxes = await odooCall<Array<Record<string, unknown>>>(
        'account.tax',
        'read',
        {
          ids: taxIds,
          fields: ['id', 'name', 'amount', 'price_include'],
        },
      )
      productTaxes = taxes.map((tax) => ({
        id: tax.id as number,
        name: tax.name as string,
        amount: tax.amount as number,
        price_include: tax.price_include as boolean,
      }))
    }

    const result: ProductDetails = {
      product,
      attributes: attributeLines,
      comboLines: comboLines,
      taxes: productTaxes,
    }

    return NextResponse.json(result)
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
