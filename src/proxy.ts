// import createMiddleware from 'next-intl/middleware';
// import {routing} from './i18n/routing';

// export default createMiddleware(routing);

// export const config = {
//   // Match all pathnames except for
//   // - /api (API routes)
//   // - /_next (Next.js internals)
//   // - /_proxy (if applicable)
//   // - /static (static files)
//   // - /favicon.ico, /sitemap.xml, /robots.txt (metadata files)
//   matcher: ['/((?!api|_next|_proxy|static|favicon.ico|sitemap.xml|robots.txt).*)']
// };


import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"
import { NextRequest, NextResponse } from "next/server"

const handleI18nRouting = createMiddleware(routing)

const PROTECTED_ROUTES = ['/profile', '/track']

function isProtectedRoute(pathname: string) {
  // Check if pathname matches any of the protected routes, with or without locale prefix
  return PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`) || 
    /\/[a-z]{2}\//.test(pathname) && (pathname.includes(`${route}`) || pathname.includes(`${route}/`))
  )
}

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export default function proxy(request: NextRequest) {
  const nonce = generateNonce()

  const cspDirectives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-eval'",
      "https://js.stripe.com",
      "https://m.stripe.network",
      "https://q.stripe.com"
    ],
    'connect-src': [
      "'self'",
      "https://api.stripe.com",
      "https://m.stripe.network",
      "https://q.stripe.com",
      "https://demo.primetek.in",
      "wss://demo.primetek.in"
    ],
    'frame-src': [
      "'self'",
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://m.stripe.network"
    ],
    'img-src': [
      "'self'",
      "data:",
      "blob:",
      "https://images.unsplash.com",
      "https://*.unsplash.com",
      "https://*.stripe.com",
      "https://q.stripe.com",
      "https://lh3.googleusercontent.com",
      "https://*.googleusercontent.com",
      "https://demo.primetek.in"
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com"
    ],
    'font-src': [
      "'self'",
      "https://fonts.gstatic.com",
      "data:"
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'", "https://checkout.stripe.com"]
  };

  const csp = Object.entries(cspDirectives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  // Attach nonce to request headers so React can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  // 1. Auth check for protected routes
  const pathname = request.nextUrl.pathname
  const session = request.cookies.get('session')?.value

  if (isProtectedRoute(pathname) && !session) {
    // Redirect to auth page, preserving locale if present
    const localeMatch = pathname.match(/^\/([a-z]{2})\//)
    const locale = localeMatch ? localeMatch[1] : 'en'
    return NextResponse.redirect(new URL(`/${locale}/auth`, request.url))
  }

  const response = handleI18nRouting(
    new NextRequest(request.url, {
      headers: requestHeaders,
    })
  )

  response.headers.set("Content-Security-Policy", csp)

  return response
}

export const config = {
  // matcher: [
  //   "/((?!api|_next|_proxy|static|favicon.ico|sitemap.xml|robots.txt).*)",
  // ],
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ]
}