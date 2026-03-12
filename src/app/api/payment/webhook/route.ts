import { NextRequest, NextResponse } from 'next/server'
import { getPaymentProvider, getWebhookSecret } from '@/lib/payment/factory'
import { fulfillOdooOrder } from '@/lib/odoo-fulfillment'
import type { PaymentProviderType } from '@/lib/payment/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  console.log('--- RECEIVED WEBHOOK PING ---')
  const { searchParams } = new URL(req.url)
  const providerType = (searchParams.get('provider') || 'stripe') as PaymentProviderType
  console.log(`[webhook] Provider: ${providerType}`)

  try {
    const body = await req.text()

    // Route to correct signature header per provider
    let signature: string | null = null
    if (providerType === 'stripe') {
      signature = req.headers.get('stripe-signature')
    } else if (providerType === 'razorpay') {
      signature = req.headers.get('x-razorpay-signature')
    }

    if (!signature) {
      console.error(`[webhook] No signature header for ${providerType}`)
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
    }

    const webhookSecret = await getWebhookSecret(providerType)
    const provider = await getPaymentProvider(providerType)

    const result = await provider.verifyWebhook(body, signature, webhookSecret)

    if (!result.success) {
      console.warn(`[webhook] Verification failed: ${result.error}`)
      // If it's an unhandled event type, return 200 to acknowledge
      if (result.error?.startsWith('Unhandled')) {
        return NextResponse.json({ received: true })
      }
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Fulfill the Odoo order
    if (result.payload) {
      console.log(`[webhook] Fulfilling order for ${providerType}: ${result.providerReference}`)
      try {
        const odooResult = await fulfillOdooOrder(result.payload, result.providerReference)
        console.log(`✅ [webhook] Fulfillment SUCCESS: ${odooResult.posReference}`)
      } catch (fulfillError: any) {
        console.error(`❌ [webhook] Fulfillment FAILED:`, fulfillError.message)
        // Return 500 so provider can retry
        return NextResponse.json(
          { error: `Fulfillment failed: ${fulfillError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[webhook] Critical error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
