import { odooCall } from './odoo-client'
import type { OdooRecord, Product } from './types'

class RecordMap {
  private map: Map<number, any>
  constructor(records: any) {
    const list = Array.isArray(records) ? records : records?.result || []
    this.map = new Map(list.map((r: any) => [Number(r.id), r]))
  }
  get(id: any) {
    return this.map.get(Number(id))
  }
}

export interface GetProductsOptions {
  limit?: number
  offset?: number
  query?: string
}

export async function getRestaurantProducts(options: GetProductsOptions = {}) {
  const { limit = 100, offset = 0, query } = options
  const ODOO_MODEL = 'product.product'

  // Fetch POS products that are available for sale
  // Exclude tips-type products (no pos category or named 'Tips'/'Tip')
  const domain: any[] = [
    ['sale_ok', '=', true],
    ['available_in_pos', '=', true],
    ['name', 'not ilike', 'tip'],
  ]
  if (query) {
    domain.push(['name', 'ilike', query])
  }

  const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain })

  const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
    domain,
    fields: [
      'id',
      'name',
      'list_price',
      'image_256',
      'product_tmpl_id',
      'attribute_line_ids',
      'pos_categ_ids',
      'taxes_id',
      'combo_ids',
      'description_sale',
      'product_tag_ids',
      'available_in_pos',
    ],
    limit,
    offset,
    order: 'name asc',
  })

  // Fetch POS Categories
  const allCategoryIds = [
    ...new Set(
      records.flatMap((r: OdooRecord) => (r.pos_categ_ids as number[]) || []),
    ),
  ]

  let categories: OdooRecord[] = []
  if (allCategoryIds.length > 0) {
    categories = await odooCall<OdooRecord[]>('pos.category', 'read', {
      ids: allCategoryIds,
      fields: ['id', 'name', 'sequence', 'parent_id'],
    })
  }

  // Fetch Product Tags
  const allTagIds = [
    ...new Set(
      records.flatMap((r: OdooRecord) => (r.product_tag_ids as number[]) || []),
    ),
  ]

  let tagsArray: OdooRecord[] = []
  if (allTagIds.length > 0) {
    tagsArray = await odooCall<OdooRecord[]>('product.tag', 'read', {
      ids: allTagIds,
      fields: ['id', 'name', 'color'],
    })
  }

  const tags: Record<number, { id: number; name: string; color?: number }> = {}
  for (const t of tagsArray) {
    tags[t.id as number] = {
      id: t.id as number,
      name: t.name as string,
      color: t.color as number,
    }
  }

  return {
    data: records as unknown as Product[],
    meta: {
      total,
      limit,
      offset,
      model: ODOO_MODEL,
      domain,
      categories,
      tags,
    },
  }
}

export async function getRestaurantProductDetails(id: number) {
  const products = await odooCall<Record<string, unknown>[]>(
    'product.product',
    'read',
    {
      ids: [id],
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
    return null
  }

  const product = products[0]
  const tmplId = (product.product_tmpl_id as [number, string] | undefined)?.[0]

  let attributeLines: any[] = []
  let comboLines: any[] = []

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
    const tmplAttributeLineIds =
      (tmplData.attribute_line_ids as number[] | undefined) || []
    const comboIds = (tmplData.combo_ids as number[] | undefined) || []

    // 2. Process Attribute Lines
    if (tmplAttributeLineIds.length > 0) {
      const lines = await odooCall<Record<string, unknown>[]>(
        'product.template.attribute.line',
        'read',
        {
          ids: tmplAttributeLineIds,
          fields: ['id', 'attribute_id', 'product_template_value_ids'],
        },
      )

      // Batch fetch all attribute names and display types
      const attributeIds = [
        ...new Set(lines.map((l) => (l.attribute_id as [number, string])[0])),
      ]
      const attributesData =
        attributeIds.length > 0
          ? await odooCall<Record<string, unknown>[]>(
              'product.attribute',
              'read',
              {
                ids: attributeIds,
                fields: ['id', 'name', 'display_type'],
              },
            )
          : []

      const attrMap = new RecordMap(attributesData)

      // Batch fetch all template attribute values (Odoo 19)
      const allValueIds = [
        ...new Set(
          lines.flatMap(
            (l) => (l.product_template_value_ids as number[]) || [],
          ),
        ),
      ]
      const allValues =
        allValueIds.length > 0
          ? await odooCall<any[]>('product.template.attribute.value', 'read', {
              ids: allValueIds,
              fields: [
                'id',
                'name',
                'price_extra',
                'product_attribute_value_id',
              ],
            })
          : []

      const valueMap = new RecordMap(allValues)

      for (const line of lines) {
        const attrId = (line.attribute_id as [number, string] | undefined)?.[0]
        const attrData = attrId ? attrMap.get(attrId) : null
        const valueIds =
          (line.product_template_value_ids as number[] | undefined) || []
        const values = valueIds.map((vid) => valueMap.get(vid)).filter(Boolean)

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

      const allComboItemIds = combos.flatMap(
        (c) => (c.combo_item_ids as number[]) || [],
      )

      if (allComboItemIds.length > 0) {
        const comboItems = await odooCall<Record<string, unknown>[]>(
          'product.combo.item',
          'read',
          {
            ids: allComboItemIds,
            fields: ['id', 'combo_id', 'product_id', 'extra_price'],
          },
        )

        const productsByComboId: Record<
          number,
          Array<{ id: number; productId: number; extraPrice: number }>
        > = {}
        for (const item of comboItems) {
          const comboId = Array.isArray(item.combo_id)
            ? item.combo_id[0]
            : (item.combo_id as number) || 0
          const productId = Array.isArray(item.product_id)
            ? item.product_id[0]
            : (item.product_id as number) || 0
          const extraPrice = (item.extra_price as number) || 0
          const id = (item.id as number) || 0

          if (!productsByComboId[comboId]) {
            productsByComboId[comboId] = []
          }
          productsByComboId[comboId].push({ id, productId, extraPrice })
        }

        const allProductIds = [
          ...new Set(
            Object.values(productsByComboId)
              .flat()
              .map((p) => p.productId),
          ),
        ]

        const productDetailsMap: Record<
          number,
          {
            id: number
            name: string
            list_price: number
            combo_ids?: number[]
            attribute_line_ids?: number[]
          }
        > = {}
        if (allProductIds.length > 0) {
          const productsData = await odooCall<Record<string, unknown>[]>(
            'product.product',
            'read',
            {
              ids: allProductIds,
              fields: ['id', 'name', 'list_price', 'product_tmpl_id'],
            },
          )
          // Also fetch product templates to get combo_ids and attribute_line_ids for sub-products
          const tmplIds = [
            ...new Set(
              productsData
                .map((p) =>
                  Array.isArray(p.product_tmpl_id)
                    ? (p.product_tmpl_id as [number, string])[0]
                    : null,
                )
                .filter(Boolean) as number[],
            ),
          ]
          let tmplComboMap: Record<number, number[]> = {} // tmplId -> combo_ids
          let tmplAttrMap: Record<number, number[]> = {} // tmplId -> attribute_line_ids
          if (tmplIds.length > 0) {
            const tmplData = await odooCall<Record<string, unknown>[]>(
              'product.template',
              'read',
              {
                ids: tmplIds,
                fields: ['id', 'combo_ids', 'attribute_line_ids'],
              },
            )
            for (const t of tmplData) {
              tmplComboMap[t.id as number] = (t.combo_ids as number[]) || []
              tmplAttrMap[t.id as number] =
                (t.attribute_line_ids as number[]) || []
            }
          }
          for (const p of productsData) {
            const pid = (p.id as number) || 0
            const tmplId = Array.isArray(p.product_tmpl_id)
              ? (p.product_tmpl_id as [number, string])[0]
              : null
            const subComboIds = tmplId ? tmplComboMap[tmplId] || [] : []
            const attrLineIds = tmplId ? tmplAttrMap[tmplId] || [] : []
            productDetailsMap[pid] = {
              id: pid,
              name: (p.name as string) || '',
              list_price: (p.list_price as number) || 0,
              combo_ids: subComboIds,
              attribute_line_ids: attrLineIds,
            }
          }
        }

        // Fetch nested combo lines for any sub-product that has combo_ids
        const allSubComboIds = [
          ...new Set(
            Object.values(productDetailsMap).flatMap((p) => p.combo_ids || []),
          ),
        ]

        // Build attributes map for combo item products
        const comboProductAttributesMap: Record<number, any[]> = {} // productId -> attributes array
        const allAttrLineIds = [
          ...new Set(
            Object.values(productDetailsMap).flatMap(
              (p) => p.attribute_line_ids || [],
            ),
          ),
        ]
        if (allAttrLineIds.length > 0) {
          const lines = await odooCall<Record<string, unknown>[]>(
            'product.template.attribute.line',
            'read',
            {
              ids: allAttrLineIds,
              fields: ['id', 'attribute_id', 'product_template_value_ids'],
            },
          )

          // Batch fetch all attribute names and display types
          const attributeIds = [
            ...new Set(
              lines.map((l) => (l.attribute_id as [number, string])[0]),
            ),
          ]
          const attributesData =
            attributeIds.length > 0
              ? await odooCall<Record<string, unknown>[]>(
                  'product.attribute',
                  'read',
                  {
                    ids: attributeIds,
                    fields: ['id', 'name', 'display_type'],
                  },
                )
              : []

          const attrMap = new RecordMap(attributesData)

          // Batch fetch all template attribute values
          const allValueIds = [
            ...new Set(
              lines.flatMap(
                (l) => (l.product_template_value_ids as number[]) || [],
              ),
            ),
          ]
          const allValues =
            allValueIds.length > 0
              ? await odooCall<any[]>(
                  'product.template.attribute.value',
                  'read',
                  {
                    ids: allValueIds,
                    fields: [
                      'id',
                      'name',
                      'price_extra',
                      'product_attribute_value_id',
                    ],
                  },
                )
              : []

          const valueMap = new RecordMap(allValues)

          const comboAttrLines: any[] = []
          for (const line of lines) {
            const attrId = (
              line.attribute_id as [number, string] | undefined
            )?.[0]
            const attrData = attrId ? attrMap.get(attrId) : null
            const valueIds =
              (line.product_template_value_ids as number[] | undefined) || []
            const values = valueIds
              .map((vid) => valueMap.get(vid))
              .filter(Boolean)

            comboAttrLines.push({
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

          // Map attributes by product - for each product in combo, find matching attributes
          for (const [productId, prodDetail] of Object.entries(
            productDetailsMap,
          )) {
            const attrLineIds = prodDetail.attribute_line_ids || []
            const matchingAttrs = comboAttrLines.filter((attr) =>
              attrLineIds.includes(attr.id),
            )
            if (matchingAttrs.length > 0) {
              comboProductAttributesMap[parseInt(productId)] = matchingAttrs
            }
          }
        }

        // Map: subComboId -> { name, products[] }
        const nestedComboLineMap: Record<
          number,
          { id: number; name: string; required: boolean; products: any[] }
        > = {}
        if (allSubComboIds.length > 0) {
          const subCombos = await odooCall<Record<string, unknown>[]>(
            'product.combo',
            'read',
            {
              ids: allSubComboIds,
              fields: ['id', 'name', 'combo_item_ids'],
            },
          )
          const subComboItemIds = subCombos.flatMap(
            (c) => (c.combo_item_ids as number[]) || [],
          )
          let subComboItems: Record<string, unknown>[] = []
          if (subComboItemIds.length > 0) {
            subComboItems = await odooCall<Record<string, unknown>[]>(
              'product.combo.item',
              'read',
              {
                ids: subComboItemIds,
                fields: ['id', 'combo_id', 'product_id', 'extra_price'],
              },
            )
          }
          // Group items by combo id
          const subItemsByComboId: Record<
            number,
            Array<{ id: number; productId: number; extraPrice: number }>
          > = {}
          for (const item of subComboItems) {
            const cid = Array.isArray(item.combo_id)
              ? (item.combo_id as [number, string])[0]
              : (item.combo_id as number) || 0
            const pid = Array.isArray(item.product_id)
              ? (item.product_id as [number, string])[0]
              : (item.product_id as number) || 0
            if (!subItemsByComboId[cid]) subItemsByComboId[cid] = []
            subItemsByComboId[cid].push({
              id: item.id as number,
              productId: pid,
              extraPrice: (item.extra_price as number) || 0,
            })
          }
          // Fetch sub-product names
          const allSubProductIds = [
            ...new Set(
              Object.values(subItemsByComboId)
                .flat()
                .map((i) => i.productId),
            ),
          ]
          let subProductMap: Record<
            number,
            { id: number; name: string; list_price: number }
          > = {}
          if (allSubProductIds.length > 0) {
            const spData = await odooCall<Record<string, unknown>[]>(
              'product.product',
              'read',
              {
                ids: allSubProductIds,
                fields: ['id', 'name', 'list_price'],
              },
            )
            for (const sp of spData) {
              subProductMap[sp.id as number] = {
                id: sp.id as number,
                name: sp.name as string,
                list_price: (sp.list_price as number) || 0,
              }
            }
          }
          for (const sc of subCombos) {
            const scId = sc.id as number
            const items = subItemsByComboId[scId] || []
            nestedComboLineMap[scId] = {
              id: scId,
              name: sc.name as string,
              required: true,
              products: items
                .map((it) => {
                  const sp = subProductMap[it.productId]
                  if (!sp) return null
                  return {
                    ...sp,
                    list_price: it.extraPrice,
                    combo_item_id: it.id,
                  }
                })
                .filter(Boolean),
            }
          }
        }

        for (const combo of combos) {
          const comboId = (combo.id as number) || 0
          const itemDetails = productsByComboId[comboId] || []
          const productsList = itemDetails
            .map((item) => {
              const prod = productDetailsMap[item.productId]
              if (!prod) return null
              // Build nested combo_lines for this sub-product (e.g., Bacon Burger's Sides)
              const subNestedLines = (prod.combo_ids || [])
                .map(function (scId) {
                  return nestedComboLineMap[scId]
                })
                .filter(Boolean)

              // Include attributes for this combo item product
              const prodAttributes =
                comboProductAttributesMap[item.productId] || []

              return {
                ...prod,
                // In a combo, the product's list_price is ignored; only the combo's extra_price matters.
                list_price: item.extraPrice,
                // Linkage for expansion
                combo_id: comboId,
                combo_item_id: item.id,
                // Attributes for this combo item (e.g., Sides for Cheese Burger in Burger Menu Combo)
                attributes:
                  prodAttributes.length > 0 ? prodAttributes : undefined,
                // Nested combo options (e.g., Sides for a burger chosen within combo)
                combo_lines:
                  subNestedLines.length > 0 ? subNestedLines : undefined,
              }
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)

          comboLines.push({
            id: comboId,
            name: (combo.name as string) || `Option ${comboLines.length + 1}`,
            max_item: (combo.max_item || 1) as number,
            included_item: 0,
            required: true,
            product_ids: itemDetails.map((d) => d.productId),
            products: productsList,
          })
        }
      }
    }
  }

  // 4. Fetch tax details
  let productTaxes: any[] = []
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

  return {
    product,
    attributes: attributeLines,
    combo_lines: comboLines,
    taxes: productTaxes,
  }
}
