import { NextResponse } from 'next/server';
import { odooCall } from '@/lib/odoo-client';
import { encrypt } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // 1. Check if user already exists
    const existingUsers = await odooCall<Array<{ id: number }>>('res.users', 'search_read', {
      domain: [['login', '=', email]],
      fields: ['id'],
      limit: 1,
    });

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    // 2. Create res.partner
    const partnerIds = await odooCall<number[]>('res.partner', 'create', {
      vals_list: [{
        name: name,
        email: email,
        customer_rank: 1,
      }],
    });

    if (!partnerIds || partnerIds.length === 0) {
      throw new Error('Failed to create partner');
    }
    const partnerId = partnerIds[0];

    // 3. Create res.users
    // Group ID 10 is Portal (base.group_portal)
    const userIds = await odooCall<number[]>('res.users', 'create', {
      vals_list: [{
        name: name,
        login: email,
        password: password,
        partner_id: partnerId,
        group_ids: [[6, 0, [10]]], // Assign Portal group
      }],
    });

    if (!userIds || userIds.length === 0) {
      throw new Error('Failed to create user');
    }
    const userId = userIds[0];

    // 4. Create session
    const user = { id: userId, name: name, email: email };
    const session = await encrypt(user);

    const response = NextResponse.json({
      message: 'User created successfully',
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
    console.error('Signup Error:', err);
    return NextResponse.json(
      { message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
