
import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import type { OdooRecord, OrderPayload } from '@/lib/types';

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


export async function POST(request: NextRequest) {
  try {
    const payload: OrderPayload = await request.json();
    const { cartItems } = payload;

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ message: 'Cart is empty.' }, { status: 400 });
    }

    // 1. Find an active POS session
    const activeSessions = await odooCall<OdooRecord[]>('pos.session', 'search_read', {
      domain: [['state', '=', 'opened']],
      fields: ['id', 'company_id'],
      limit: 1,
    });

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ message: 'Sorry, the restaurant is currently closed. No active POS session found.' }, { status: 400 });
    }
    const sessionId = activeSessions[0].id;
    const companyId = activeSessions[0].company_id ? activeSessions[0].company_id[0] : false;

    // 2. Prepare order lines from cart items
    const orderLines = cartItems.map(item => [0, 0, {
      product_id: item.product_id,
      qty: item.quantity,
      price_unit: item.list_price,
      price_subtotal: item.list_price * item.quantity,
      price_subtotal_incl: item.list_price * item.quantity,
      note: item.notes || '',
    }]);

    // 3. Create the pos.order record following the doc
    const orderData = {
      name: "Web Order", // Odoo will generate a real name
      session_id: sessionId,
      partner_id: false, // Guest checkout
      company_id: companyId,
      lines: orderLines,
      amount_tax: null,
      amount_total: null,
      amount_paid: null,
      amount_return: null,
    };
    
    const newOrders = await odooCall<OdooRecord[]>('pos.order', 'create', {
      vals_list: [orderData],
    });

    if (!newOrders || newOrders.length === 0 || !newOrders[0].id) {
      return NextResponse.json({ message: 'Failed to create order in Odoo or retrieve new order ID.' }, { status: 500 });
    }
    
    const newOrderId = newOrders[0].id;

    // In a real scenario, we'd proceed to payment processing here.
    // For demo purposes, we'll consider the order created.
    
    return NextResponse.json({ success: true, orderId: newOrderId, message: `Order #${newOrderId} created successfully!` });

  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
