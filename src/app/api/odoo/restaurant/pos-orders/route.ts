import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { OdooRecord, CartItem, CustomerDetails } from '@/lib/types';

const ODOO_MODEL = "pos.order";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const sessionId = searchParams.get('session_id');

    const domain: any[] = [];
    if (startDate) {
      domain.push(['date_order', '>=', `${startDate} 00:00:00`]);
    }
    if (endDate) {
      domain.push(['date_order', '<=', `${endDate} 23:59:59`]);
    }
    if (sessionId) {
      domain.push(['session_id', '=', Number(sessionId)]);
    }

    const fieldsDef = await odooCall<Record<string, any>>(ODOO_MODEL, 'fields_get', {});
    const fieldNames = Object.keys(fieldsDef);
    
    const total = await odooCall<number>(ODOO_MODEL, 'search_count', { domain });
    
    const records = await odooCall<OdooRecord[]>(ODOO_MODEL, 'search_read', {
      domain,
      fields: fieldNames,
      limit,
      offset,
      order: 'date_order desc',
    });

    return NextResponse.json({ 
      data: records, 
      meta: { total, limit, offset, model: ODOO_MODEL, domain }
    });

  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}

type OrderPayload = {
  cartItems: CartItem[];
  customer: CustomerDetails;
  paymentMethod: string;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const payload: OrderPayload = await request.json();
    const { cartItems, customer, total } = payload;

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ message: 'Cart is empty.' }, { status: 400 });
    }

    // 1. Find an active POS session
    const activeSessions = await odooCall<OdooRecord[]>('pos.session', 'search_read', {
      domain: [['state', '=', 'opened']],
      fields: ['id'],
      limit: 1,
    });

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ message: 'Sorry, the restaurant is currently closed. No active POS session found.' }, { status: 400 });
    }
    const sessionId = activeSessions[0].id;

    // 2. Prepare order lines from cart items
    const orderLines = cartItems.map(item => [0, 0, {
      product_id: item.product.id,
      qty: item.quantity,
      price_unit: item.product.list_price,
      note: item.notes || '',
      // Odoo calculates taxes, totals, etc. automatically
    }]);

    // 3. Create the pos.order record
    const orderData = {
      session_id: sessionId,
      // For now, we're not creating/linking customers for guests
      partner_id: false, 
      lines: orderLines,
      amount_total: total,
      amount_tax: 0, // Odoo will calculate
      amount_paid: 0, // Will be 0 until payment is processed
      amount_return: 0,
    };
    
    const newOrderId = await odooCall<number>('pos.order', 'create', [orderData]);

    // In a real scenario, we'd proceed to payment processing here.
    // For demo purposes, we'll consider the order created.
    // We could call `action_pos_order_paid` after creating a payment record.

    return NextResponse.json({ success: true, orderId: newOrderId, message: `Order #${newOrderId} created successfully!` });

  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
