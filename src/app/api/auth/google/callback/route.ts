import { NextRequest, NextResponse } from 'next/server';
import { odooCall, OdooClientError } from '@/lib/odoo-client';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[API /auth/google/callback GET] OAuth Error:', error);
      return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/auth?error=No+authorization+code+provided', request.url));
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;

    if (!state || state !== storedState) {
      return NextResponse.redirect(new URL('/auth?error=Invalid+state+parameter', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[API /auth/google/callback GET] Missing Google OAuth environment variables');
      return NextResponse.redirect(new URL('/auth?error=Server+configuration+error', request.url));
    }

    // 1. Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('[API /auth/google/callback GET] Token exchange error:', tokenData);
      return NextResponse.redirect(new URL('/auth?error=Failed+to+exchange+token', request.url));
    }

    // 2. Fetch user profile from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();

    if (!userRes.ok || !userData.email) {
      console.error('[API /auth/google/callback GET] User info error:', userData);
      return NextResponse.redirect(new URL('/auth?error=Failed+to+fetch+user+profile', request.url));
    }

    const email = userData.email;
    const name = userData.name || 'Google User';
    const picture = userData.picture || '';

    // 3. Find or Create User in Odoo
    const existingUsers = await odooCall<any[]>('res.users', 'search_read', {
      domain: [['login', '=', email]],
      fields: ['id', 'name', 'partner_id'],
      limit: 1,
    });

    let userId: number;
    let userName = name;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
      userName = existingUsers[0].name;
    } else {
      // Create partner
      const partnerIds = await odooCall<number[]>('res.partner', 'create', {
        vals_list: [{ name, email, customer_rank: 1 }],
      });
      if (!partnerIds || partnerIds.length === 0) throw new Error('Failed to create partner');
      const partnerId = partnerIds[0];

      // Create user
      const userIds = await odooCall<number[]>('res.users', 'create', {
        vals_list: [{
          name,
          login: email,
          password: Math.random().toString(36).slice(-10), // Random password for OAuth users
          partner_id: partnerId,
          group_ids: [[6, 0, [10]]], // Assign Portal group
        }],
      });
      if (!userIds || userIds.length === 0) throw new Error('Failed to create user');
      userId = userIds[0];
    }

    // 4. Create local JWT session
    const userPayload = { id: userId, name: userName, email, image: picture };
    const session = await encrypt(userPayload);
    
    const response = NextResponse.redirect(new URL('/profile', request.url));
    response.cookies.set('session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Clean up oauth state cookie
    response.cookies.delete('oauth_state');

    return response;

  } catch (error) {
    console.error('[API /auth/google/callback GET] Unhandled error:', error);
    return NextResponse.redirect(new URL('/auth?error=Authentication+failed+unexpectedly', request.url));
  }
}
