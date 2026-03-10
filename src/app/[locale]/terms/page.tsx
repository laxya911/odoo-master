
import React from 'react';

export default function TermsPage() {
    return (
        <div className="container mx-auto px-4 py-20 max-w-4xl">
            <h1 className="text-4xl font-black font-headline mb-10">Terms of <span className="text-primary">Service</span></h1>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">1. Acceptance of Terms</h2>
                    <p>By accessing and using RAM Indian Restaurant's online ordering platform, you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">2. Ordering and Payment</h2>
                    <p>All orders are subject to availability and acceptance. We reserve the right to refuse service to anyone at any time. Prices are as listed on our platform and are subject to change without notice.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">3. Cancellations and Refunds</h2>
                    <p>Due to the nature of prepared food, cancellations must be made within 5 minutes of placing an order. Refunds are handled on a case-by-case basis through our customer support team.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">4. Liability</h2>
                    <p>RAM Indian Restaurant is not liable for any delays in delivery caused by factors outside of our control, including weather, traffic, or third-party delivery provider issues.</p>
                </section>
            </div>
        </div>
    );
}
