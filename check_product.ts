
import { odooCall } from './src/lib/odoo-client';

async function main() {
  try {
    const products = await odooCall<any[]>('product.product', 'search_read', {
      domain: [['name', 'ilike', 'Sushi Lunch Combo']],
      fields: ['id', 'name', 'list_price', 'product_tmpl_id'],
      limit: 1
    });

    if (products.length === 0) {
      console.log('Product not found');
      return;
    }

    const product = products[0];
    console.log('Product:', JSON.stringify(product, null, 2));

    const tmplId = product.product_tmpl_id[0];
    const templates = await odooCall<any[]>('product.template', 'read', {
      ids: [tmplId],
      fields: ['combo_ids']
    });

    const comboIds = templates[0].combo_ids;
    console.log('Combo IDs:', comboIds);

    const combos = await odooCall<any[]>('product.combo', 'read', {
      ids: comboIds,
      fields: ['id', 'name', 'qty_free', 'base_price', 'combo_item_ids']
    });

    console.log('Combos:', JSON.stringify(combos, null, 2));

    const allItemIds = combos.flatMap(c => c.combo_item_ids);
    const items = await odooCall<any[]>('product.combo.item', 'read', {
      ids: allItemIds,
      fields: ['id', 'product_id', 'extra_price']
    });

    console.log('Combo Items:', JSON.stringify(items, null, 2));

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
