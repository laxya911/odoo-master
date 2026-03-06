import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('[API /auth/google/login GET] Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI');
      return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 500 });
    }

    // Generate a random state for security
    const state = crypto.randomUUID();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid email profile');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', state);

    // We can set the state in a cookie to verify it in the callback
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('[API /auth/google/login GET] Error generating auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate authorization URL' }, { status: 500 });
  }
}
