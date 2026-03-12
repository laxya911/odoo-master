import { PaymentProvider, PaymentProviderType } from './types';
import { odooCall } from '@/lib/odoo-client';

export async function getPaymentProvider(type: PaymentProviderType): Promise<PaymentProvider> {
    if (type === 'stripe') {
        const providers = await odooCall<any[]>('payment.provider', 'search_read', {
            domain: [['code', '=', 'stripe'], ['state', 'in', ['enabled', 'test']]],
            fields: ['id', 'stripe_secret_key'],
        });
        const secretKey = providers?.[0]?.stripe_secret_key;
        if (!secretKey) throw new Error('Stripe secret key not configured in Odoo');

        const { StripeAdapter } = await import('./providers/stripe');
        return new StripeAdapter(secretKey);
    }

    if (type === 'razorpay') {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured in environment');

        const { RazorpayAdapter } = await import('./providers/razorpay');
        return new RazorpayAdapter(keyId, keySecret);
    }

    throw new Error(`Unsupported payment provider: ${type}`);
}

export async function getWebhookSecret(type: PaymentProviderType): Promise<string> {
    if (type === 'stripe') {
        const providers = await odooCall<any[]>('payment.provider', 'search_read', {
            domain: [['code', '=', 'stripe'], ['state', 'in', ['enabled', 'test']]],
            fields: ['id', 'stripe_secret_key', 'stripe_webhook_secret'],
        });
        const secret = providers?.[0]?.stripe_webhook_secret;
        if (!secret) throw new Error('Stripe webhook secret not configured in Odoo');
        return secret;
    }

    if (type === 'razorpay') {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) throw new Error('Razorpay webhook secret not configured in environment');
        return secret;
    }

    throw new Error(`Unsupported provider: ${type}`);
}
