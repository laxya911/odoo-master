'use server';

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
    console.error("[API /restaurant/pos-orders GET] Odoo Error:", odooError.odooError || odooError.message);
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("--- Starting POS Order Creation ---");
  try {
    const payload: OrderPayload = await request.json();
    const { cartItems, customer } = payload;
    console.log("Received Payload:", { cartItemCount: cartItems.length, customer });

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ message: 'Cart is empty.' }, { status: 400 });
    }

    // 1. Find an active POS session and a CASH payment method
    console.log("Step 1: Finding active POS session...");
    const activeSessions = await odooCall<OdooRecord[]>('pos.session', 'search_read', {
      domain: [['state', '=', 'opened']],
      fields: ['id', 'config_id'],
      limit: 1,
    });

    if (!activeSessions || activeSessions.length === 0) {
      console.error("No active POS session found.");
      return NextResponse.json({ message: 'Sorry, the restaurant is currently closed. No active POS session found.' }, { status: 400 });
    }
    const session = activeSessions[0];
    const sessionId = session.id;
    console.log(`Found active session ID: ${sessionId}`);

    // 2. Find or create a customer (res.partner)
    console.log(`Step 2: Finding or creating customer for email: ${customer.email}`);
    let partnerId: number | false = false;
    const existingPartners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
        domain: [['email', '=', customer.email]],
        fields: ['id'],
        limit: 1,
    });

    if (existingPartners.length > 0) {
        partnerId = existingPartners[0].id;
        console.log(`Found existing partner with ID: ${partnerId}`);
    } else {
        console.log("No existing partner found, creating a new one...");
        const newPartnerPayload = { name: customer.name, email: customer.email };
        console.log("New partner payload:", newPartnerPayload);
        const newPartnerId = await odooCall<number>('res.partner', 'create', {
            vals: newPartnerPayload
        });
        partnerId = newPartnerId;
        console.log(`Created new partner with ID: ${partnerId}`);
    }

     if (!partnerId) {
        console.error("Failed to find or create a partner.");
        return NextResponse.json({ message: 'Could not find or create customer.' }, { status: 500 });
    }

    // 3. Prepare order lines and create a DRAFT pos.order
    console.log("Step 3: Preparing order lines...");
    const orderLines = cartItems.map(item => {
        const subtotal = item.list_price * item.quantity;
        return [0, 0, {
            product_id: item.product_id,
            qty: item.quantity,
            price_unit: item.list_price,
            price_subtotal: subtotal,
            price_subtotal_incl: subtotal, // Odoo will recalculate with taxes anyway
            note: item.notes || '',
        }];
    });

    const orderData = {
        name: "Web Order", // Odoo will generate a real name
        session_id: sessionId,
        partner_id: partnerId,
        lines: orderLines,
        to_invoice: false, // Let's keep it simple for now
        amount_tax: 0, 
        amount_total: 0,
        amount_paid: 0,
        amount_return: 0,
    };
    
    console.log("Step 4: Creating draft POS order with payload:", JSON.stringify(orderData, null, 2));

    const newOrderId = await odooCall<number>('pos.order', 'create', {
      vals: orderData
    });

    if (!newOrderId) {
      console.error("Odoo 'create' method did not return a new order ID.");
      return NextResponse.json({ message: 'Failed to create order in Odoo.' }, { status: 500 });
    }
    
    console.log(`--- Successfully created DRAFT order #${newOrderId} ---`);

    // NOTE: The next steps (payment and validation) are skipped for now to debug incrementally.
    // This should create an order with customer details and line item totals, but it will be in a draft state.
    
    return NextResponse.json({ success: true, orderId: newOrderId, message: `Draft Order #${newOrderId} created successfully! Please complete payment in Odoo.` });

  } catch (error) {
    const odooError = error as OdooClientError;
    console.error("[API /restaurant/pos-orders POST] An error occurred:");
    console.error("Status:", odooError.status);
    console.error("Message:", odooError.message);
    console.error("Odoo Error Details:", JSON.stringify(odooError.odooError, null, 2));
    
    return NextResponse.json(
      { message: odooError.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
