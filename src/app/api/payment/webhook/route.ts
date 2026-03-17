import { NextRequest, NextResponse } from 'next/server'
import { getPaymentProvider, getWebhookSecret } from '@/lib/payment/factory'
import { fulfillOdooOrder } from '@/lib/odoo-fulfillment'
import { logToFile } from '@/lib/debug-logger'
import type { PaymentProviderType } from '@/lib/payment/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const providerType = (searchParams.get('provider') || 'stripe') as PaymentProviderType
  console.log(`[webhook] Incoming signal for provider: ${providerType}`);
  
  try {
    const body = await req.text()
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => { headersObj[key] = value; });
    
    logToFile(`[webhook] Signal received`, { 
      provider: providerType, 
      bodyLength: body.length,
      headers: headersObj 
    });

    const webhookSecret = await getWebhookSecret(providerType)
    console.log(`[webhook] Using secret suffix: ...${webhookSecret.slice(-4)}`);

    // Route to correct signature header per provider
    let signature: string | null = null
    if (providerType === 'stripe') {
      signature = req.headers.get('stripe-signature')
    } else if (providerType === 'razorpay') {
      signature = req.headers.get('x-razorpay-signature')
    }

    if (!signature) {
      console.error(`❌ [webhook] No signature header for ${providerType}`)
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
    }

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
      logToFile(`[webhook] Fulfilling order for ${providerType}: ${result.providerReference}`, result.payload);
      console.log(`[webhook] Fulfilling order for ${providerType}: ${result.providerReference}`)
      try {
        const odooResult = await fulfillOdooOrder(result.payload, result.providerReference)
        logToFile(`[webhook] Fulfillment SUCCESS`, odooResult);
        console.log(`✅ [webhook] Fulfillment SUCCESS: ${odooResult.posReference}`)
      } catch (fulfillError: any) {
        logToFile(`[webhook] Fulfillment FAILED`, { error: fulfillError.message, stack: fulfillError.stack });
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
