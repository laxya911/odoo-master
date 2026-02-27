import { NextRequest, NextResponse } from 'next/server'
import { odooCall } from '@/lib/odoo-client'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Let's create a dummy partner and dummy transaction
    const transactionVals = {
      amount: 100,
      currency_id: 1, // Usually USD or something, need to fetch
      provider_id: 8, // from previous call
      reference: 'TEST-TX-' + Date.now(),
      partner_id: 1, // admin
      operation: 'online_direct'
    };
    
    const txId = await odooCall<any>('payment.transaction', 'create', { vals_list: [transactionVals] });
    
    // Now fetch the transaction to see if stripe_payment_intent is there
    const tx = await odooCall<any>('payment.transaction', 'read', { ids: txId, fields: [] });
    
    return NextResponse.json({ txId, tx });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
