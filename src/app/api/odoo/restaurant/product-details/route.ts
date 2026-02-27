import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic'

export interface AttributeValue {
  id: number
  name: string
  price_extra?: number
}

export interface AttributeLine {
  id: number
  name: string
  attribute?: { id: number; name: string } | null
  display_type?: string
  values: AttributeValue[]
}

export interface ComboLine {
  id: number
  name?: string
  combo_category_id?: [number, string] | string | null
  max_item?: number
  included_item?: number
  required?: boolean
  product_ids: number[]
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
    const comboLines: ComboLine[] = []

    if (tmplId) {
      // 1. Fetch Template data
      const templates = await odooCall<Record<string, unknown>[]>(
        'product.template',
        'read',
        {
          ids: [tmplId],
          fields: ['attribute_line_ids', 'combo_ids'],
        },
      )
      
      const tmplData = templates[0] || {}
      const tmplAttributeLineIds = (tmplData.attribute_line_ids as number[] | undefined) || []
      const comboIds = (tmplData.combo_ids as number[] | undefined) || []

      // 2. Process Attribute Lines
      if (tmplAttributeLineIds.length > 0) {
        const lines = await odooCall<Record<string, unknown>[]>(
          'product.template.attribute.line',
          'read',
          {
            ids: tmplAttributeLineIds,
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
                  fields: ['id', 'name', 'display_type'],
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
            name: (attrData?.name as string) || '',
            attribute: attrData
              ? {
                  id: (attrData.id as number) || 0,
                  name: (attrData.name as string) || '',
                }
              : null,
            display_type: (attrData?.display_type as any) || 'radio',
            values,
          })
        }
      }

      // 3. Process Combo Lines
      if (comboIds.length > 0) {
        const combos = await odooCall<Record<string, unknown>[]>(
          'product.combo',
          'read',
          {
            ids: comboIds,
            fields: ['id', 'name', 'combo_item_ids'],
          },
        )

        const allComboItemIds = combos.flatMap(c => (c.combo_item_ids as number[] || []))
        
        if (allComboItemIds.length > 0) {
          const comboItems = await odooCall<Record<string, unknown>[]>(
            'product.combo.item',
            'read',
            {
              ids: allComboItemIds,
              fields: ['combo_id', 'product_id', 'extra_price'],
            },
          )

          const productsByComboId: Record<number, Array<{ productId: number; extraPrice: number }>> = {}
          for (const item of comboItems) {
            const rawComboId = item.combo_id
            const comboId = Array.isArray(rawComboId) ? rawComboId[0] : (rawComboId as number) || 0
            
            const rawProductId = item.product_id
            const productId = Array.isArray(rawProductId) ? rawProductId[0] : (rawProductId as number) || 0
            
            const extraPrice = (item.extra_price as number) || 0
            
            if (!productsByComboId[comboId]) {
              productsByComboId[comboId] = []
            }
            productsByComboId[comboId].push({ productId, extraPrice })
          }

          const allProductIds = [
            ...new Set(Object.values(productsByComboId).flat().map(p => p.productId)),
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
            const itemDetails = productsByComboId[comboId] || []
            const productsList = itemDetails
              .map(item => {
                  const prod = productDetailsMap[item.productId]
                  if (!prod) return null
                  return {
                      ...prod,
                      list_price: prod.list_price + item.extraPrice
                  }
              })
              .filter(Boolean)

            comboLines.push({
              id: comboId,
              name: (combo.name as string) || `Option ${comboLines.length + 1}`,
              combo_category_id: (combo as Record<string, unknown>).combo_category_id as any,
              max_item: ((combo as Record<string, unknown>).max_item || 1) as number,
              included_item: 0,
              required: true,
              product_ids: itemDetails.map(d => d.productId),
              products: productsList as any,
            })
          }
        }
      }
    }

    // 4. Fetch tax details
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

    const result = {
      product,
      attributes: attributeLines,
      combo_lines: comboLines,
      taxes: productTaxes,
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
