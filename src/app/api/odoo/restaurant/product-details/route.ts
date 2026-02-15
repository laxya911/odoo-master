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
          'combo_ids',
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
    const tmpl = Array.isArray(product.product_tmpl_id)
      ? (product.product_tmpl_id as [number, string])[0]
      : (product.product_tmpl_id as number)

    // 2) Attribute lines for this template
    const attributeLines: AttributeLine[] = []

    if (tmpl) {
      const lines = await odooCall<Record<string, unknown>[]>(
        'product.template.attribute.line',
        'search_read',
        {
          domain: [['product_tmpl_id', '=', tmpl]],
          fields: ['id', 'attribute_id', 'value_ids'],
        },
      )

      for (const line of lines) {
        const attrId = Array.isArray(line.attribute_id)
          ? (line.attribute_id as [number, string])[0]
          : (line.attribute_id as number)

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

        const valueIds = Array.isArray(line.value_ids)
          ? (line.value_ids as number[])
          : []

        const values: AttributeValue[] =
          valueIds.length > 0
            ? await odooCall<AttributeValue[]>(
                'product.attribute.value',
                'read',
                {
                  ids: valueIds,
                  fields: ['id', 'name', 'price_extra'],
                },
              )
            : []

        attributeLines.push({
          id: line.id as number,
          attribute: attr[0]
            ? {
                id: (attr[0] as Record<string, unknown>).id as number,
                name: (attr[0] as Record<string, unknown>).name as string,
              }
            : null,
          values,
        })
      }
    }

    // 3) Combo lines via product.template.combo_ids -> product.combo -> product.combo.item
    const comboLines: ComboLine[] = []

    if (tmpl) {
      try {
        // read combo_ids from template
        const tmplData = await odooCall<Record<string, unknown>[]>(
          'product.template',
          'read',
          {
            ids: [tmpl],
            fields: ['combo_ids'],
          },
        )

        const tmplComboIds = Array.isArray(tmplData[0]?.combo_ids)
          ? (tmplData[0].combo_ids as number[])
          : []

        // also include combo_ids that might be set on the product variant
        const variantComboIds = Array.isArray(product?.combo_ids)
          ? (product.combo_ids as number[])
          : []

        // merge unique combo ids from template and variant
        const comboIdsSet = new Set<number>([
          ...tmplComboIds,
          ...variantComboIds,
        ])
        const comboIds = Array.from(comboIdsSet)

        if (comboIds.length) {
          // read combos from legacy product.combo first
          let combos = await odooCall<Record<string, unknown>[]>(
            'product.combo',
            'read',
            {
              ids: comboIds,
              fields: [
                'id',
                'combo_category_id',
                'max_item',
                'included_item',
                'required',
              ],
            },
          )

          // if product.combo isn't present or returned nothing, try pos.combo.line which some DBs use
          if (!combos || combos.length === 0) {
            combos = await odooCall<Record<string, unknown>[]>(
              'pos.combo.line',
              'read',
              {
                ids: comboIds,
                fields: [
                  'id',
                  'combo_category_id',
                  'max_item',
                  'included_item',
                  'required',
                  'product_ids',
                ],
              },
            )
          }

          // If combos from pos.combo.line include product_ids on the combo record, use them directly.
          // Otherwise, fall back to reading product.combo.item model if available.
          const itemsByCombo: Record<number, number[]> = {}
          // collect product_ids if present on combo records
          for (const combo of combos || []) {
            const cid = combo.id as number
            if (Array.isArray(combo.product_ids) && combo.product_ids.length) {
              itemsByCombo[cid] = combo.product_ids as number[]
            }
          }

          // if we didn't get items from combos, try product.combo.item model
          if (Object.keys(itemsByCombo).length === 0) {
            try {
              const comboItems = await odooCall<Record<string, unknown>[]>(
                'product.combo.item',
                'search_read',
                {
                  domain: [['combo_id', 'in', comboIds]],
                  fields: ['id', 'combo_id', 'product_id'],
                },
              )
              for (const item of comboItems) {
                const comboId = Array.isArray(item.combo_id)
                  ? (item.combo_id as [number, string])[0]
                  : (item.combo_id as number)
                const comboProdId = Array.isArray(item.product_id)
                  ? (item.product_id as [number, string])[0]
                  : (item.product_id as number)
                if (!itemsByCombo[comboId]) itemsByCombo[comboId] = []
                itemsByCombo[comboId].push(comboProdId)
              }
            } catch {
              // ignore if product.combo.item doesn't exist
            }
          }

          for (const combo of combos) {
            const cid = combo.id as number
            const productIds = itemsByCombo[cid] || []
            let productsList: Array<{
              id: number
              name: string
              list_price: number
            }> = []

            if (productIds.length) {
              const productsData = await odooCall<Record<string, unknown>[]>(
                'product.product',
                'read',
                {
                  ids: productIds,
                  fields: ['id', 'name', 'list_price'],
                },
              )
              productsList = productsData.map((p) => ({
                id: p.id as number,
                name: p.name as string,
                list_price: (p.list_price as number) || 0,
              }))
            }

            comboLines.push({
              id: cid,
              combo_category_id:
                combo.combo_category_id as ComboLine['combo_category_id'],
              max_item: (combo.max_item as number) || 1,
              included_item: (combo.included_item as number) || 0,
              required: Boolean(combo.required),
              products: productsList,
            })
          }
        }
      } catch {
        // if combo models are missing, just skip combos
      }
    }

    const result: ProductDetails = {
      product,
      // always return arrays (may be empty) to make client checks simpler
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
