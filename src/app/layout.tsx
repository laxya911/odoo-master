import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

import { CompanyProvider } from '@/context/CompanyContext'
import { AuthProvider } from '@/context/AuthContext'

import { SessionProvider } from '@/context/SessionContext'
import { PaymentConfigProvider } from '@/context/PaymentConfigContext'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CartProvider } from '@/context/CartContext'
import { ProductProvider } from '@/context/ProductContext'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { FloatingOrderOrb } from '@/components/cart/FloatingOrderOrb'

export const metadata: Metadata = {
  title: 'Odoo Manager',
  description: 'Management console for Odoo',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap'
          rel='stylesheet'
        />
      </head>
      <body className='font-body antialiased bg-foreground'>
        <CompanyProvider>
          <AuthProvider>
            <SessionProvider>
              <PaymentConfigProvider>
                <CartProvider>
                  <ProductProvider>
                    <Navbar />
                    {children}
                    <CartDrawer />
                    <FloatingOrderOrb />
                    <Footer />
                    <Toaster />
                  </ProductProvider>
                </CartProvider>
              </PaymentConfigProvider>
            </SessionProvider>
          </AuthProvider>
        </CompanyProvider>
      </body>
    </html>
  )
}
