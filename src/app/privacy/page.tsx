
import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="container mx-auto px-4 py-20 max-w-4xl">
            <h1 className="text-4xl font-black font-headline mb-10">Data <span className="text-primary">Protection Policy</span></h1>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">1. Information We Collect</h2>
                    <p>We collect information necessary to fulfill your orders, including your name, email address, delivery address, and phone number. Payment information is processed securely through Stripe and is not stored on our servers.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">2. How We Use Your Data</h2>
                    <p>Your data is used exclusively for order fulfillment, customer support, and, with your consent, occasional marketing communications regarding RAM Indian Restaurant.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">3. Data Sharing</h2>
                    <p>We do not sell your personal information to third parties. We only share necessary data with our delivery partners and payment processors to complete your transactions.</p>
                </section>
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">4. Your Rights</h2>
                    <p>You have the right to access, correct, or delete your personal data. Please contact us at privacy@ramrestaurant.jp for any data-related inquiries.</p>
                </section>
            </div>
        </div>
    );
}
