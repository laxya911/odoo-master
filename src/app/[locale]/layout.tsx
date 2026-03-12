import type { Metadata } from 'next'
import '../globals.css'
import { Toaster } from 'sonner'
import { CompanyProvider } from '@/context/CompanyContext'
import { AuthProvider } from '@/context/AuthContext'

import { SessionProvider } from '@/context/SessionContext'
import { PaymentConfigProvider } from '@/context/PaymentConfigContext'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CartProvider } from '@/context/CartContext'
import { ProductProvider } from '@/context/ProductContext'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import Script from 'next/script'
import { headers } from 'next/headers';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });

  return {
    title: t('seo.title'),
    description: t('seo.description'),
    alternates: {
      canonical: '/',
      languages: {
        'en-US': '/en',
        'ja-JP': '/ja',
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") || ""
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'

        />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://m.stripe.network" />
        <link rel="preconnect" href="https://q.stripe.com" />
        <link
          href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap'
          rel='stylesheet'
        />
      </head>
      <body className='font-body antialiased bg-foreground'>
        <Script
          src="https://js.stripe.com/v3"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <NextIntlClientProvider messages={messages}>
          <CompanyProvider>
            <AuthProvider>
              <SessionProvider>
                <PaymentConfigProvider>
                  <ProductProvider>
                    <CartProvider>
                      <Navbar />
                      {children}
                      <CartDrawer />
                      <Footer />
                      <Toaster richColors position="top-center" closeButton />
                    </CartProvider>
                  </ProductProvider>
                </PaymentConfigProvider>
              </SessionProvider>
            </AuthProvider>
          </CompanyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
