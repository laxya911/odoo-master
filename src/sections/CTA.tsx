'use client'
import React from 'react';
import Link from 'next/link';
interface CTAProps {
    onNavigateMenu?: () => void;
}

export const CTA: React.FC<CTAProps> = ({ onNavigateMenu }) => {

    const handleExplore = () => {
        if (onNavigateMenu) {
            onNavigateMenu();
        } else {
            document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="relative">
            {/* Party Course CTA */}
            <section className="py-20 relative overflow-hidden bg-neutral-950">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-accent-gold/5 blur-[120px]" />
                <div className="container mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-display font-bold mb-8">Parties & Groups</h2>
                    <p className="text-xl text-white/50 mb-12 max-w-2xl mx-auto italic">
                        &quot;All-you-can-eat courses available. Perfect for celebrations, company events, or family gatherings.&quot;
                    </p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <Link href="/booking?tab=party">
                            <button className="px-12 py-6 bg-accent-gold text-primary font-bold rounded-full tracking-widest uppercase hover:bg-white transition-colors shadow-2xl"
                                onClick={handleExplore}>
                                Book a Party
                            </button>
                        </Link>
                        <button
                            onClick={() => window.open('/party-menu.html', '_blank')}
                            className="px-12 py-6 border border-white/10 text-white font-bold rounded-full tracking-widest uppercase hover:bg-white/5 transition-colors"
                        >
                            Party Menu PDF
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};
