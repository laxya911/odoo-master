import Stripe from 'stripe';
import { PaymentProvider, CheckoutSessionResponse, WebhookResult } from '../types';
import { CreatePaymentRequest, OrderPayload, OrderLineItem } from '@/lib/types';
import { calculateOrderTotal, getCompanyCurrency, toSmallestUnit } from '@/lib/odoo-order-utils';
import { logToFile } from '@/lib/debug-logger';

export class StripeAdapter implements PaymentProvider {
    private stripe: Stripe;

    constructor(secretKey: string) {
        this.stripe = new Stripe(secretKey);
    }

    async createCheckoutSession(
        body: CreatePaymentRequest, 
        orderId: string, 
        origin: string
    ): Promise<CheckoutSessionResponse> {
        // Expand and calculate total
        const { expandCartItems } = await import('@/lib/odoo-order-utils');
        const orderLines = expandCartItems(body.cart.items);
        const { amount_total, lines: processedLines } = await calculateOrderTotal(orderLines);
        const currency = await getCompanyCurrency();

        // Generate Odoo-friendly UTC format: YYYY-MM-DD HH:MM:SS
        const now = new Date();
        const pad = (num: number) => num.toString().padStart(2, '0');
        const odooTimestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
        
        // Stripe Customer
        let customerId: string | undefined;
        const existingCustomers = await this.stripe.customers.list({
            email: body.customer.email,
            limit: 1,
        });

        if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id;
        } else {
            const newCustomer = await this.stripe.customers.create({
                email: body.customer.email,
                name: body.customer.name,
                phone: body.customer.phone,
                address: {
                    line1: body.customer.street,
                    city: body.customer.city,
                    postal_code: body.customer.zip,
                },
            });
            customerId = newCustomer.id;
        }

        // Prepare metadata (Stripe Checkout Session allows metadata)
        const metadata: Record<string, string> = {
            cart_id: body.cart_id || '',
            order_id: orderId,
            order_type: body.orderType,
            customer_name: body.customer.name,
            customer_email: body.customer.email,
            customer_phone: body.customer.phone || '',
            street: body.customer.street || '',
            city: body.customer.city || '',
            zip: body.customer.zip || '',
            notes: body.customer_note || '',
            line_count: processedLines.length.toString(),
            provider: 'stripe',
            created_at: odooTimestamp
        };

        processedLines.forEach((line, index) => {
            const compact = {
                p: line.product_id,
                q: line.quantity,
                pr: line.list_price,
                pri: line.price_unit_incl,
                t: line.tax_ids,
                n: line.customer_note || '',
                c: line.combo_id,
                ci: line.combo_item_id,
                a: line.attribute_value_ids,
            };
            metadata[`line_${index}`] = JSON.stringify(compact);
        });

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Order from RAM & CO.`,
                        },
                        unit_amount: toSmallestUnit(amount_total, currency),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer: customerId,
            success_url: `${origin}/track/latest?success=true&session_id={CHECKOUT_SESSION_ID}&created_at=${encodeURIComponent(odooTimestamp)}`,
            cancel_url: `${origin}/cart?canceled=true`,
            metadata: metadata,
            payment_intent_data: {
                metadata: metadata
            }
        });

        if (!session.url) throw new Error('Failed to create stripe session url');

        return {
            url: session.url,
            sessionId: session.id
        };
    }

    async verifyWebhook(
        body: string, 
        signature: string, 
        secret: string
    ): Promise<WebhookResult> {
        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(body, signature, secret);
        } catch (err: any) {
            return { success: false, error: err.message, providerReference: '' };
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata || {};
            
            // Reconstruct order lines
            const orderLines: OrderLineItem[] = [];
            const lineCount = parseInt(metadata.line_count || '0');
            for (let i = 0; i < lineCount; i++) {
                const lineJson = metadata[`line_${i}`];
                if (lineJson) {
                    const item = JSON.parse(lineJson);
                    orderLines.push({
                        product_id: item.p,
                        quantity: item.q,
                        list_price: item.pr,
                        price_unit_incl: item.pri,
                        tax_ids: item.t || [],
                        customer_note: item.n || '',
                        combo_id: item.c,
                        combo_item_id: item.ci,
                        attribute_value_ids: item.a,
                    } as any);
                }
            }

            const payload: OrderPayload = {
                orderLines,
                customer: {
                    name: metadata.customer_name || '',
                    email: metadata.customer_email || '',
                    phone: metadata.customer_phone || '',
                    street: metadata.street || '',
                    city: metadata.city || '',
                    zip: metadata.zip || '',
                },
                paymentMethod: 'stripe',
                orderType: (metadata.order_type as any) || 'delivery',
                customer_note: metadata.notes || '',
                total: session.amount_total ? session.amount_total / 100 : 0, // Simplified, should use fromSmallestUnit
            };

            return {
                success: true,
                payload,
                providerReference: session.id,
                orderId: metadata.order_id
            };
        }

        logToFile(`[stripe] Unhandled event type: ${event.type}`);
        return { success: false, error: `Unhandled event type: ${event.type}`, providerReference: '' };
    }
}
