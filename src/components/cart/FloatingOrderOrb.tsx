'use client';

import { OrderOrb } from './OrderOrb';

export function FloatingOrderOrb() {
    return (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto hidden md:block">
            <OrderOrb variant="floating" />
        </div>
    );
}
