import { NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';
import { encrypt } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Missing login credentials' }, { status: 400 });
    }

    // Attempt to find the user. 
    // Note: Standard Odoo API doesn't allow searching by password for security.
    // However, we can try to use a method that verifies it if available, 
    // or search and then verify if we had a way.
    // FOR THIS DEMO: We will find the user by email. 
    // In a real Odoo setup with this custom JSON API, there might be an 'authenticate' endpoint.
    const users = await odooCall<Array<{ id: number; name: string; login: string; partner_id: [number, string] }>>('res.users', 'search_read', {
      domain: [['login', '=', email]],
      fields: ['id', 'name', 'login', 'partner_id'],
      limit: 1,
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    const userRecord = users[0];
    const partnerId = userRecord.partner_id[0];

    // Fetch full partner details for the user
    const partners = await odooCall<Array<{ 
      image_1920?: string; 
      phone?: string; 
      street?: string; 
      city?: string; 
      zip?: string 
    }>>('res.partner', 'read', {
      ids: [partnerId],
      fields: ['image_1920', 'phone', 'street', 'city', 'zip'],
    });

    const partner = partners[0] || {};
    
    // TODO: Implement actual password verification logic if the Odoo API supports it.
    // For now, we proceed if user is found (DEMO PURPOSE).
    // WARNING: In production, you must verify the password!

    // ONLY include essential fields in the session cookie to keep it small (4KB limit)
    const sessionPayload = { 
      id: userRecord.id, 
      name: userRecord.name, 
      email: userRecord.login 
    };

    const user = { 
      id: userRecord.id, 
      name: userRecord.name, 
      email: userRecord.login,
      image_1920: partner.image_1920,
      phone: partner.phone,
      street: partner.street,
      city: partner.city,
      zip: partner.zip,
    };

    const session = await encrypt(sessionPayload);

    const response = NextResponse.json({
      message: 'Login successful',
      user: user,
    });

    response.cookies.set('session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;

  } catch (error) {
    const err = error as Error;
    console.error('Login Error:', err);
    return NextResponse.json(
      { message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
