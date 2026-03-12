import { CreatePaymentRequest, OrderPayload } from '@/lib/types';

export interface CheckoutSessionResponse {
    url: string;
    sessionId?: string;
}

export interface WebhookResult {
    success: boolean;
    orderId?: string;
    payload?: OrderPayload;
    providerReference: string;
    error?: string;
}

export interface PaymentProvider {
    createCheckoutSession(
        body: CreatePaymentRequest, 
        orderId: string, 
        origin: string
    ): Promise<CheckoutSessionResponse>;
    
    verifyWebhook(
        body: string, 
        signature: string, 
        secret: string
    ): Promise<WebhookResult>;
}

export type PaymentProviderType = 'stripe' | 'razorpay';
