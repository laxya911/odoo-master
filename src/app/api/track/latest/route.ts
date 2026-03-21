import { NextRequest, NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';
import { logToFile } from '@/lib/debug-logger';
import { OdooRecord, PosOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';

// In-memory lock to prevent multiple concurrent fulfillment triggers for the same session
const activeFulfillments = new Set<string>();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');
    const sessionId = searchParams.get('session_id');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 1. Find the partner
    const partners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
      domain: [['email', '=', email]],
      fields: ['id'],
      limit: 1,
    });

    if (!partners.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const partnerId = partners[0].id;

    // 2. Find the latest POS orders for this partner
    const searchOrder = async () => {
      const orders = await odooCall<PosOrder[]>('pos.order', 'search_read', {
        domain: [['partner_id', '=', partnerId]],
        fields: ['id', 'pos_reference', 'state', 'date_order', 'amount_total', 'unique_uuid'],
        limit: 20,
        order: 'date_order desc',
      });

      if (!orders || orders.length === 0) return [];

      // A. Match by exact reference, suffix, or unique_uuid (Odoo 19 uses unique_uuid for Stripe refs)
      const suffix = sessionId.slice(-8);
      const match = orders.find(o => 
        o.pos_reference === sessionId || 
        o.pos_reference?.includes(suffix) ||
        (o as any).unique_uuid === sessionId
      );
      
      if (match) {
        console.log(`[latest-poll] Found exact match for sessionId ${sessionId}: ${match.id}`);
        return [match];
      }

      // B. RELAXED FALLBACK (Only for generic searches without a specific session)
      if (!sessionId) {
        const latest = orders[0];
        const orderDate = new Date(latest.date_order + 'Z');
        const now = new Date();
        const diffMinutes = (now.getTime() - orderDate.getTime()) / (1000 * 60);

        if (diffMinutes < 2) {
          console.log(`[latest-poll] No exact match, but latest order ${latest.id} is very recent (${diffMinutes.toFixed(1)}m). Returning as likely match.`);
          return [latest];
        }
      }

      console.log(`[latest-poll] No match found for sessionId ${sessionId}.`);
      return [];
    };

    let orders = await searchOrder();

    // 3. Sync Fallback: Trigger fulfillment if no order found AND not already in progress
    if (!orders.length) {
      if (activeFulfillments.has(sessionId)) {
        console.log(`[latest-poll] Fulfillment already in progress for ${sessionId}.`);
        return NextResponse.json({ status: 'processing', message: 'Fulfillment in progress' });
      }

      activeFulfillments.add(sessionId);
      logToFile(`[latest-poll] Triggering recovery fulfillment for ${sessionId}...`);
      
      try {
        const { getPaymentProvider } = await import('@/lib/payment/factory');
        const { fulfillOdooOrder } = await import('@/lib/odoo-fulfillment');
        
        const provider = await getPaymentProvider('stripe');
        const session = await provider.retrieveSession(sessionId);
        
        if (session.success && session.payload) {
          await fulfillOdooOrder(session.payload, session.providerReference);
          // Re-search after fulfillment
          orders = await searchOrder();
        }
      } catch (e: any) {
        logToFile(`[latest-poll] Recovery fulfillment failed: ${e.message}`);
      } finally {
        activeFulfillments.delete(sessionId);
      }
    }

    if (!orders.length) {
      return NextResponse.json({ error: 'Order synchronization in progress...' }, { status: 404 });
    }

    return NextResponse.json(orders[0]);

  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
