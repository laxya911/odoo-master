import { NextRequest, NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payment/factory'
import type { CreatePaymentRequest } from '@/lib/types'
import type { PaymentProviderType } from '@/lib/payment/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const providerType = (searchParams.get('provider') || 'stripe') as PaymentProviderType

    const body: CreatePaymentRequest = await req.json()

    if (!body.cart?.items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    console.log(`[/api/payment/create-session] Provider: ${providerType}, items: ${body.cart.items.length}`)

    const provider = await getPaymentProvider(providerType)

    // Generate a unique orderId for cross-referencing
    const orderId = crypto.randomUUID()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000'

    const result = await provider.createCheckoutSession(body, orderId, origin)

    console.log(`[/api/payment/create-session] Session created successfully. URL: ${result.url}`)

    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
      orderId,
      provider: providerType,
    })
  } catch (error: any) {
    console.error('[/api/payment/create-session] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
