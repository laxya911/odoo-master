import { odooCall } from './odoo-client';
import type { OdooRecord, Product } from './types';

class RecordMap {
  private map: Map<number, any>;
  constructor(records: any) {
    const list = Array.isArray(records) ? records : (records?.result || []);
    this.map = new Map(list.map((r: any) => [Number(r.id), r]));
  }
  get(id: any) { return this.map.get(Number(id)); }
}

export interface GetProductsOptions {
  limit?: number;
  offset?: number;
  query?: string;
}

export async function getRestaurantProducts(options: GetProductsOptions = {}) {
  const { limit = 100, offset = 0, query } = options;
  const ODOO_MODEL = "product.product";

  // Fetch POS products that are available for sale
  // Exclude tips-type products (no pos category or named 'Tips'/'Tip')
  const domain: any[] = [
    ['sale_ok', '=', true],
    ['available_in_pos', '=', true],
    ['name', 'not ilike', 'tip'],
  ];
  if (query) {
    domain.push(['name', 'ilike', query]);
  }

  const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain });
  
  const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
    domain,
    fields: [
      'id', 'name', 'list_price', 'image_256',
      'product_tmpl_id', 'attribute_line_ids',
      'pos_categ_ids', 'taxes_id', 'combo_ids',
      'description_sale', 'product_tag_ids',
      'available_in_pos',
    ],
    limit,
    offset,
    order: 'name asc',
  });

  // Fetch POS Categories
  const allCategoryIds = [
    ...new Set(records.flatMap((r: OdooRecord) => (r.pos_categ_ids as number[]) || [])),
  ];

  let categories: OdooRecord[] = [];
  if (allCategoryIds.length > 0) {
    categories = await odooCall<OdooRecord[]>('pos.category', 'read', {
      ids: allCategoryIds,
      fields: ['id', 'name', 'sequence', 'parent_id'],
    });
  }

  // Fetch Product Tags
  const allTagIds = [
    ...new Set(records.flatMap((r: OdooRecord) => (r.product_tag_ids as number[]) || [])),
  ];

  let tagsArray: OdooRecord[] = [];
  if (allTagIds.length > 0) {
    tagsArray = await odooCall<OdooRecord[]>('product.tag', 'read', {
      ids: allTagIds,
      fields: ['id', 'name', 'color'],
    });
  }

  const tags: Record<number, { id: number; name: string; color?: number }> = {};
  for (const t of tagsArray) {
    tags[t.id as number] = { id: t.id as number, name: t.name as string, color: t.color as number };
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
    }
  };
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
  );

  if (!products || products.length === 0) {
    return null;
  }

  const product = products[0];
  const tmplId = (product.product_tmpl_id as [number, string] | undefined)?.[0];

  let attributeLines: any[] = [];
  let comboLines: any[] = [];

  if (tmplId) {
    // 1. Fetch Template data
    const templates = await odooCall<Record<string, unknown>[]>(
      'product.template',
      'read',
      {
        ids: [tmplId],
        fields: ['attribute_line_ids', 'combo_ids'],
      },
    );
    
    const tmplData = templates[0] || {};
    const tmplAttributeLineIds = (tmplData.attribute_line_ids as number[] | undefined) || [];
    const comboIds = (tmplData.combo_ids as number[] | undefined) || [];

    // 2. Process Attribute Lines
    if (tmplAttributeLineIds.length > 0) {
      const lines = await odooCall<Record<string, unknown>[]>(
        'product.template.attribute.line',
        'read',
        {
          ids: tmplAttributeLineIds,
          fields: ['id', 'attribute_id', 'product_template_value_ids'],
        },
      );

      // Batch fetch all attribute names and display types
      const attributeIds = [...new Set(lines.map(l => (l.attribute_id as [number, string])[0]))];
      const attributesData = attributeIds.length > 0 
        ? await odooCall<Record<string, unknown>[]>('product.attribute', 'read', {
            ids: attributeIds,
            fields: ['id', 'name', 'display_type'],
          })
        : [];
      
      const attrMap = new RecordMap(attributesData);

      // Batch fetch all template attribute values (Odoo 19)
      const allValueIds = [...new Set(lines.flatMap(l => (l.product_template_value_ids as number[]) || []))];
      const allValues = allValueIds.length > 0
        ? await odooCall<any[]>('product.template.attribute.value', 'read', {
            ids: allValueIds,
            fields: ['id', 'name', 'price_extra', 'product_attribute_value_id'],
          })
        : [];
      
      const valueMap = new RecordMap(allValues);

      for (const line of lines) {
        const attrId = (line.attribute_id as [number, string] | undefined)?.[0];
        const attrData = attrId ? attrMap.get(attrId) : null;
        const valueIds = (line.product_template_value_ids as number[] | undefined) || [];
        const values = valueIds.map(vid => valueMap.get(vid)).filter(Boolean);

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
        });
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
            fields: ['id', 'combo_id', 'product_id', 'extra_price'],
          },
        )

        const productsByComboId: Record<number, Array<{ id: number; productId: number; extraPrice: number }>> = {}
        for (const item of comboItems) {
          const comboId = Array.isArray(item.combo_id) ? item.combo_id[0] : (item.combo_id as number) || 0
          const productId = Array.isArray(item.product_id) ? item.product_id[0] : (item.product_id as number) || 0
          const extraPrice = (item.extra_price as number) || 0
          const id = (item.id as number) || 0
          
          if (!productsByComboId[comboId]) {
            productsByComboId[comboId] = []
          }
          productsByComboId[comboId].push({ id, productId, extraPrice })
        }

        const allProductIds = [
          ...new Set(Object.values(productsByComboId).flat().map(p => p.productId)),
        ]

        const productDetailsMap: Record<number, { id: number; name: string; list_price: number }> = {}
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
                    // In a combo, the product's list_price is ignored; only the combo's extra_price matters.
                    list_price: item.extraPrice,
                    // Linkage for expansion
                    combo_id: comboId,
                    combo_item_id: item.id
                }
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)

          comboLines.push({
            id: comboId,
            name: (combo.name as string) || `Option ${comboLines.length + 1}`,
            max_item: (combo.max_item || 1) as number,
            included_item: 0,
            required: true,
            product_ids: itemDetails.map(d => d.productId),
            products: productsList,
          })
        }
      }
    }
  }

  // 4. Fetch tax details
  let productTaxes: any[] = [];
  if (
    product.taxes_id &&
    Array.isArray(product.taxes_id) &&
    product.taxes_id.length > 0
  ) {
    const taxIds = product.taxes_id as number[];
    const taxes = await odooCall<Array<Record<string, unknown>>>(
      'account.tax',
      'read',
      {
        ids: taxIds,
        fields: ['id', 'name', 'amount', 'price_include'],
      },
    );
    productTaxes = taxes.map((tax) => ({
      id: tax.id as number,
      name: tax.name as string,
      amount: tax.amount as number,
      price_include: tax.price_include as boolean,
    }));
  }

  return {
    product,
    attributes: attributeLines,
    combo_lines: comboLines,
    taxes: productTaxes,
  };
}
