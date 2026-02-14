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
    const { cartItems, customer } = payload;

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ message: 'Cart is empty.' }, { status: 400 });
    }

    // 1. Find an active POS session and a CASH payment method
    const activeSessions = await odooCall<OdooRecord[]>('pos.session', 'search_read', {
      domain: [['state', '=', 'opened']],
      fields: ['id', 'config_id'],
      limit: 1,
    });

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ message: 'Sorry, the restaurant is currently closed. No active POS session found.' }, { status: 400 });
    }
    const session = activeSessions[0];
    const sessionId = session.id;
    const configId = session.config_id[0];
    
    const posConfig = await odooCall<OdooRecord[]>('pos.config', 'read', {
        ids: [configId],
        fields: ['payment_method_ids']
    });

    if (!posConfig || posConfig.length === 0 || !posConfig[0].payment_method_ids?.length) {
         return NextResponse.json({ message: 'No payment methods configured for the active POS.' }, { status: 500 });
    }
    
    const paymentMethods = await odooCall<OdooRecord[]>('pos.payment.method', 'read', {
        ids: posConfig[0].payment_method_ids,
        fields: ['type']
    });

    const cashPaymentMethod = paymentMethods.find(pm => pm.type === 'cash');
    if (!cashPaymentMethod) {
         return NextResponse.json({ message: 'No cash payment method found for Dine-In orders.' }, { status: 500 });
    }
    const paymentMethodId = cashPaymentMethod.id;


    // 2. Find or create a customer (res.partner)
    let partnerId: number | false = false;
    const existingPartners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
        domain: [['email', '=', customer.email]],
        fields: ['id'],
        limit: 1,
    });

    if (existingPartners.length > 0) {
        partnerId = existingPartners[0].id;
    } else {
        const newPartnerId = await odooCall<number>('res.partner', 'create', {
            vals: {
                name: customer.name,
                email: customer.email,
            }
        });
        partnerId = newPartnerId;
    }
     if (!partnerId) {
        return NextResponse.json({ message: 'Could not find or create customer.' }, { status: 500 });
    }


    // 3. Prepare order lines and create a DRAFT pos.order
    const orderLines = cartItems.map(item => {
        const subtotal = item.list_price * item.quantity;
        return [0, 0, {
            product_id: item.product_id,
            qty: item.quantity,
            price_unit: item.list_price,
            price_subtotal: subtotal,
            price_subtotal_incl: subtotal, // Odoo will recalculate with taxes
            note: item.notes || '',
        }];
    });

    const newOrderId = await odooCall<number>('pos.order', 'create', {
      vals: {
        name: "Web Order", // Odoo will generate a real name
        session_id: sessionId,
        partner_id: partnerId,
        lines: orderLines,
        // Let odoo compute the totals
        amount_tax: 0, 
        amount_total: 0,
        amount_paid: 0,
        amount_return: 0,
      }
    });
     if (!newOrderId) {
      return NextResponse.json({ message: 'Failed to create order in Odoo.' }, { status: 500 });
    }
    
    // 4. Read the created order to get the calculated total
     const newOrders = await odooCall<OdooRecord[]>('pos.order', 'read', {
        ids: [newOrderId],
        fields: ['amount_total']
    });

    if (!newOrders || newOrders.length === 0) {
      return NextResponse.json({ message: 'Failed to read back created order.' }, { status: 500 });
    }
    const amountTotal = newOrders[0].amount_total;
    
    // 5. Create a payment record for the order
    await odooCall<any>('pos.payment', 'create', {
        vals: {
            pos_order_id: newOrderId,
            amount: amountTotal,
            payment_method_id: paymentMethodId
        }
    });
    
    // 6. Validate the order by calling action_pos_order_paid
    await odooCall<any>('pos.order', 'action_pos_order_paid', {
        ids: [newOrderId]
    });
    
    return NextResponse.json({ success: true, orderId: newOrderId, message: `Order #${newOrderId} created successfully!` });

  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
