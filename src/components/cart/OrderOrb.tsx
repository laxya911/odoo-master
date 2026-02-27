'use client';

import { motion } from 'framer-motion';
import { useCart } from '@/context/CartContext';

export function OrderOrb({ variant = 'floating' }: { variant?: 'floating' | 'navbar' }) {
    const { cartCount, setIsCartOpen } = useCart();

    if (cartCount === 0) return null;

    return (
        <motion.button
            onClick={() => setIsCartOpen(true)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.92 }}
            className={`
        relative
        ${variant === 'floating'
                    ? 'w-16 h-16'
                    : 'w-10 h-10'}
        bg-gradient-to-br from-accent-gold to-accent-chili
        shadow-[0_0_40px_rgba(212,175,55,0.45)]
        bg-accent-gold text-primary rounded-full shadow-2xl flex items-center justify-center relative cursor-pointer
      `}
        >
            {/* subtle rotating heat ring */}
            <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 14, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-white/30"
            />

            {/* count */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="absolute top-0 right-1 translate-x-1/2 -translate-y-1/2 text-[10px] bg-white text-primary w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
            </span>
        </motion.button>
    );
}
