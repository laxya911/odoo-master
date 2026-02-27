import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { odooCall } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.id) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Fetch fresh user data including image from Odoo
    const users = await odooCall<Array<{ id: number; name: string; login: string; partner_id: [number, string] }>>('res.users', 'read', {
      ids: [session.id],
      fields: ['name', 'login', 'partner_id'],
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const odooUser = users[0];
    const partnerId = odooUser.partner_id[0];

    const partners = await odooCall<Array<{ image_1920?: string; phone?: string; street?: string; city?: string; zip?: string }>>('res.partner', 'read', {
      ids: [partnerId],
      fields: ['image_1920', 'phone', 'street', 'city', 'zip'],
    });

    const partner = partners[0] || {};

    return NextResponse.json({
      user: {
        id: session.id,
        name: odooUser.name,
        email: odooUser.login,
        image_1920: partner.image_1920,
        phone: partner.phone,
        street: partner.street,
        city: partner.city,
        zip: partner.zip,
      }
    });
  } catch (error) {
    console.error('Me API Error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
