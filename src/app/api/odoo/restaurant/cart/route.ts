import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Persists and retrieves the cart for authenticated users using Odoo res.partner fields.
 * We use the 'comment' field on res.partner to store the JSON-serialized cart.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ cart: null }, { status: 200 });
    }

    // 1. Get Partner ID from User
    const users = await odooCall<any[]>('res.users', 'read', {
      ids: [session.id],
      fields: ['partner_id']
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const partnerId = users[0].partner_id[0];

    // 2. Read the cart from the partner's 'comment' field
    const partners = await odooCall<any[]>('res.partner', 'read', {
      ids: [partnerId],
      fields: ['comment']
    });

    if (!partners || partners.length === 0) {
      return NextResponse.json({ cart: null }, { status: 200 });
    }

    const comment = partners[0].comment;
    if (!comment || !comment.startsWith('RAM_CART:')) {
      return NextResponse.json({ cart: null }, { status: 200 });
    }

    try {
      const cartJson = comment.substring('RAM_CART:'.length);
      const cart = JSON.parse(cartJson);
      return NextResponse.json({ cart });
    } catch (e) {
      console.error('Failed to parse cart JSON from Odoo:', e);
      return NextResponse.json({ cart: null }, { status: 200 });
    }
  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cart } = await request.json();
    if (!cart) {
      return NextResponse.json({ error: 'Cart data missing' }, { status: 400 });
    }

    // 1. Get Partner ID from User
    const users = await odooCall<any[]>('res.users', 'read', {
      ids: [session.id],
      fields: ['partner_id']
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const partnerId = users[0].partner_id[0];

    // 2. Save the cart to the partner's 'comment' field with a prefix
    const cartString = `RAM_CART:${JSON.stringify(cart)}`;
    
    await odooCall('res.partner', 'write', {
      ids: [partnerId],
      vals: { comment: cartString }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const odooError = error as OdooClientError;
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    );
  }
}
