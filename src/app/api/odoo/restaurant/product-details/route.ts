
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

    // 1) Read product.product to get template id and basic info
    const products = await odooCall<any[]>('product.product', 'read', {
      ids: [prodId],
      fields: [
        'id',
        'name',
        'list_price',
        'image_256',
        'product_tmpl_id',
        'attribute_line_ids',
      ],
    })

    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 })
    }

    const product = products[0]
    const tmplId = product.product_tmpl_id?.[0]

    // 2) Attribute lines for this template
    const attributeLines: AttributeLine[] = []
    if (tmplId && product.attribute_line_ids?.length > 0) {
      const lines = await odooCall<any[]>('product.template.attribute.line', 'search_read', {
        domain: [['product_tmpl_id', '=', tmplId]],
        fields: ['id', 'attribute_id', 'value_ids'],
      })

      for (const line of lines) {
        const attrId = line.attribute_id?.[0]
        const attr = attrId
          ? await odooCall<any[]>('product.attribute', 'read', {
              ids: [attrId],
              fields: ['id', 'name'],
            })
          : []

        const valueIds = line.value_ids || []
        const values: AttributeValue[] =
          valueIds.length > 0
            ? await odooCall<AttributeValue[]>('product.attribute.value', 'read', {
                ids: valueIds,
                fields: ['id', 'name', 'price_extra'],
              })
            : []

        attributeLines.push({
          id: line.id,
          attribute: attr[0] ? { id: attr[0].id, name: attr[0].name } : null,
          values,
        })
      }
    }

    // 3) Combo lines via product.template -> product.combo -> product.combo.item
    const comboLines: ComboLine[] = []
    if (tmplId) {
      const templates = await odooCall<any[]>('product.template', 'read', {
        ids: [tmplId],
        fields: ['combo_ids'],
      })

      const comboIds = templates[0]?.combo_ids || []

      if (comboIds.length > 0) {
        const combos = await odooCall<any[]>('product.combo', 'read', {
          ids: comboIds,
          fields: [
            'id',
            'combo_category_id',
            'max_item',
            'included_item',
            'required',
          ],
        })

        const comboItems = await odooCall<any[]>('product.combo.item', 'search_read', {
          domain: [['combo_id', 'in', comboIds]],
          fields: ['combo_id', 'product_id'],
        })

        const productsByComboId: Record<number, number[]> = {}
        for (const item of comboItems) {
          const comboId = item.combo_id[0]
          const productId = item.product_id[0]
          if (!productsByComboId[comboId]) {
            productsByComboId[comboId] = []
          }
          productsByComboId[comboId].push(productId)
        }

        const allProductIds = [...new Set(comboItems.map(item => item.product_id[0]))]

        let productDetailsMap: Record<number, { id: number; name: string; list_price: number }> = {}
        if (allProductIds.length > 0) {
          const productsData = await odooCall<any[]>('product.product', 'read', {
            ids: allProductIds,
            fields: ['id', 'name', 'list_price'],
          })
          for (const p of productsData) {
            productDetailsMap[p.id] = { id: p.id, name: p.name, list_price: p.list_price || 0 }
          }
        }

        for (const combo of combos) {
          const productIdsForCombo = productsByComboId[combo.id] || []
          const productsList = productIdsForCombo.map(pid => productDetailsMap[pid]).filter(Boolean)

          comboLines.push({
            id: combo.id,
            combo_category_id: combo.combo_category_id,
            max_item: combo.max_item || 1,
            included_item: combo.included_item || 0,
            required: Boolean(combo.required),
            products: productsList,
          })
        }
      }
    }

    const result: ProductDetails = {
      product,
      attributes: attributeLines,
      comboLines: comboLines,
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
