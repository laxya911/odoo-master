import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    baseUrl: process.env.ODOO_BASE_URL || 'https://demo.primetek.in (default)',
    db: process.env.ODOO_DB || 'ram-db (default)',
    apiKeyStatus: process.env.ODOO_API_KEY ? 'Present (First 4 chars: ' + process.env.ODOO_API_KEY.substring(0, 4) + '...)' : 'Missing',
  };

  try {
    // Attempt a simple search_count to verify connectivity
    const pingStart = Date.now();
    const count = await odooCall<number>('res.company', 'search_count', { domain: [] });
    
    // Inspect models for Odoo 19 variants
    const ptalFields = await odooCall<any>('product.template.attribute.line', 'fields_get', { 
      attributes: ['value_ids'] 
    });
    const ptavFields = await odooCall<any>('product.template.attribute.value', 'read', { 
      ids: [], // Just to see if it errors or works empty
      fields: ['name', 'price_extra', 'product_attribute_value_id'] 
    }).catch(e => e.message);

    const ppmFields = await odooCall<any>('pos.payment.method', 'fields_get', {
      attributes: ['name', 'is_online_payment', 'is_cash_count', 'use_payment_terminal']
    });

    const pingEnd = Date.now();

    return NextResponse.json({
      status: 'success',
      config,
      odoo19_inspect: {
        ptal: ptalFields,
        ptav: ptavFields,
        ppm: ppmFields
      },
      ping: {
        success: true,
        latency: `${pingEnd - pingStart}ms`,
        companyCount: count
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      config,
      ping: {
        success: false,
        error: error.message,
        details: error.odooError || null, // Capture Odoo error if any
      }
    }, { status: 500 });
  }
}
