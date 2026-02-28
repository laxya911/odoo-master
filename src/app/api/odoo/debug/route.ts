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
    const pingEnd = Date.now();

    return NextResponse.json({
      status: 'success',
      config,
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
