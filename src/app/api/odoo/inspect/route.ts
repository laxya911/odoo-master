import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';

export async function GET() {
  try {
    const orderFields = await odooCall<Record<string, any>>('pos.order', 'fields_get', {});
    const lineFields = await odooCall<Record<string, any>>('pos.order.line', 'fields_get', {});
    
    return NextResponse.json({
        order: Object.keys(orderFields).filter(f => f.includes('note') || f.includes('type') || f.includes('delivery') || f.includes('source') || f.includes('ship') || f.includes('is_')),
        lines: Object.keys(lineFields).filter(f => f.includes('note') || f.includes('desc'))
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
