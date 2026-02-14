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

    // 1. Find an active POS session and its config
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
    const sessionId = session.id as number;
    const configId = (session.config_id as [number, string])[0];
    console.log(`Found active session ID: ${sessionId} with Config ID: ${configId}`);


    // 2. Find a CASH payment method from the POS config
    console.log("Step 2: Finding a cash payment method...");
     const posConfig = await odooCall<OdooRecord[]>('pos.config', 'read', {
        ids: [configId],
        fields: ['payment_method_ids']
    });

    if (!posConfig[0]?.payment_method_ids) {
        throw new Error(`Could not find payment methods on POS Config ID: ${configId}`);
    }

    const paymentMethodIds = posConfig[0].payment_method_ids as number[];
    const paymentMethods = await odooCall<OdooRecord[]>('pos.payment.method', 'search_read', {
        domain: [['id', 'in', paymentMethodIds], ['is_cash_count', '=', true]],
        fields: ['id', 'name'],
        limit: 1
    });

    if (!paymentMethods || paymentMethods.length === 0) {
       console.error("No cash payment method found for the active POS session.");
       return NextResponse.json({ message: 'Could not find a cash payment method.' }, { status: 500 });
    }
    const paymentMethod = paymentMethods[0];
    const paymentMethodId = paymentMethod.id as number;
    console.log(`Using payment method: '${paymentMethod.name}' (ID: ${paymentMethodId})`);


    // 3. Find or create a customer (res.partner)
    console.log(`Step 3: Finding or creating customer for email: ${customer.email}`);
    let partnerId: number | false = false;
    if (customer.email) {
      const existingPartners = await odooCall<OdooRecord[]>('res.partner', 'search_read', {
          domain: [['email', '=', customer.email]],
          fields: ['id'],
          limit: 1,
      });

      if (existingPartners.length > 0) {
          partnerId = existingPartners[0].id as number;
          console.log(`Found existing partner with ID: ${partnerId}`);
      } else {
          console.log("No existing partner found, creating a new one...");
          const newPartnerPayload = { name: customer.name, email: customer.email };
          console.log("New partner payload:", newPartnerPayload);
          const newPartnerIds = await odooCall<number[]>('res.partner', 'create', {
              vals_list: [newPartnerPayload]
          });
          if (!newPartnerIds || newPartnerIds.length === 0) {
             throw new Error("Partner creation did not return an ID.");
          }
          partnerId = newPartnerIds[0];
          console.log(`Created new partner with ID: ${partnerId}`);
      }
    }


    // 4. Prepare order lines
    console.log("Step 4: Preparing order lines...");
    const orderLines = cartItems.map(item => {
        const subtotal = item.list_price * item.quantity;
        return [0, 0, {
            product_id: item.product_id,
            qty: item.quantity,
            price_unit: item.list_price,
            price_subtotal: subtotal,
            price_subtotal_incl: subtotal, 
            note: item.notes || '',
        }];
    });

    const orderData = {
        name: "Web Order",
        session_id: sessionId,
        partner_id: partnerId,
        lines: orderLines,
        to_invoice: false,
        amount_tax: 0,
        amount_total: 0,
        amount_paid: 0,
        amount_return: 0,
    };
    
    // 5. Create a DRAFT pos.order
    console.log("Step 5: Creating draft POS order...");

    const newOrderIds = await odooCall<number[]>('pos.order', 'create', {
      vals_list: [orderData]
    });

    if (!newOrderIds || newOrderIds.length === 0 || !newOrderIds[0]) {
      throw new Error("Odoo 'create' method did not return a new order ID.");
    }
    const newOrderId = newOrderIds[0];
    console.log(`--- Successfully created DRAFT order #${newOrderId} ---`);

    // 6. Fetch the order to get the calculated total
    console.log(`Step 6: Reading order #${newOrderId} to get totals...`);
    // Note: Odoo doesn't compute totals on create, so we manually calculate for payment.
    const amountTotal = orderLines.reduce((acc, line) => acc + (line[2].price_subtotal_incl || 0), 0);
    console.log(`Order total is: ${amountTotal}`);
    
    // 7. Add payment to the order
    console.log(`Step 7: Adding payment to order #${newOrderId}...`);
    await odooCall<null>(ODOO_MODEL, 'add_payment', {
        ids: [newOrderId],
        data: {
            pos_order_id: newOrderId,
            amount: amountTotal,
            payment_method_id: paymentMethodId,
        }
    });
    console.log("Payment added successfully.");

    // 8. Validate the order to move it to "Paid" state and generate invoice
    console.log(`Step 8: Validating order #${newOrderId}...`);
    const validationResult = await odooCall<any>(ODOO_MODEL, 'action_pos_order_paid', {
        ids: [newOrderId]
    });
    console.log("Order validation result:", validationResult);

    console.log(`--- Order #${newOrderId} successfully paid and validated! ---`);
    
    return NextResponse.json({ success: true, orderId: newOrderId, message: `Order #${newOrderId} created and paid successfully!` });

  } catch (error) {
    const e = error as Error;
    const odooError = error as OdooClientError;
    console.error("[API /restaurant/pos-orders POST] An error occurred:");
    console.error("Status:", odooError.status);
    console.error("Message:", e.message);
    if (odooError.odooError) {
        console.error("Odoo Error Details:", JSON.stringify(odooError.odooError, null, 2));
    }
    
    return NextResponse.json(
      { message: e.message, status: odooError.status, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
