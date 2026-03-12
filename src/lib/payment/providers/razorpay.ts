import Razorpay from 'razorpay';
import { PaymentProvider, CheckoutSessionResponse, WebhookResult } from '../types';
import { CreatePaymentRequest, OrderPayload, OrderLineItem } from '@/lib/types';
import { calculateOrderTotal, getCompanyCurrency, toSmallestUnit } from '@/lib/odoo-order-utils';
import crypto from 'crypto';

export class RazorpayAdapter implements PaymentProvider {
    private razorpay: Razorpay;

    constructor(keyId: string, keySecret: string) {
        this.razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });
    }

    async createCheckoutSession(
        body: CreatePaymentRequest, 
        orderId: string, 
        origin: string
    ): Promise<CheckoutSessionResponse> {
        const { expandCartItems } = await import('@/lib/odoo-order-utils');
        const orderLines = expandCartItems(body.cart.items);
        const { amount_total } = await calculateOrderTotal(orderLines);
        const currency = await getCompanyCurrency();

        // Create a Payment Link (Razorpay's hosted checkout)
        const paymentLink = await this.razorpay.paymentLink.create({
            amount: toSmallestUnit(amount_total, currency),
            currency: currency,
            accept_partial: false,
            reference_id: orderId,
            description: `Order from RAM & CO.`,
            customer: {
                name: body.customer.name,
                email: body.customer.email,
                contact: body.customer.phone,
            },
            notify: {
                sms: true,
                email: true,
            },
            reminder_enable: true,
            notes: {
                cart_id: body.cart_id || '',
                order_type: body.orderType,
                customer_street: body.customer.street || '',
                customer_city: body.customer.city || '',
                customer_zip: body.customer.zip || '',
                notes: body.customer_note || '',
                provider: 'razorpay'
            },
            callback_url: `${origin}/track/latest?success=true&order_id=${orderId}`,
            callback_method: 'get',
        });

        return {
            url: paymentLink.short_url,
            sessionId: paymentLink.id
        };
    }

    async verifyWebhook(
        body: string, 
        signature: string, 
        secret: string
    ): Promise<WebhookResult> {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            return { success: false, error: 'Invalid signature', providerReference: '' };
        }

        const payload = JSON.parse(body);
        const event = payload.event;

        if (event === 'payment_link.paid') {
            const paymentLink = payload.payload.payment_link.entity;
            const notes = paymentLink.notes || {};
            
            // Note: Razorpay notes have a limit, so we might need a different way 
            // to store full cart details if they don't fit. 
            // For now, we'll assume we can reconstruct or fetch if needed.
            // But since the requirement asks to recreate the order in Odoo,
            // we should ideally have the cart details.
            
            return {
                success: true,
                providerReference: paymentLink.id,
                orderId: paymentLink.reference_id,
                // We'll need a way to pass the payload back to fulfillment.
                // Since Razorpay limits metadata, we might need to store the cart in Odoo first
                // or use a temporary DB. But following the Stripe pattern for now.
            };
        }

        return { success: false, error: `Unhandled event: ${event}`, providerReference: '' };
    }
}
