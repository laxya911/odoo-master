'use client';

import { usePathname, useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';

export const LanguageSwitcher = () => {
    const pathname = usePathname();
    const router = useRouter();
    const locale = useLocale();

    const toggleLocale = () => {
        const nextLocale = locale === 'en' ? 'ja' : 'en';
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <button
            onClick={toggleLocale}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 hover:border-accent-gold transition-colors text-[10px] font-bold tracking-widest uppercase text-white"
        >
            <span className={locale === 'en' ? 'text-accent-gold' : 'text-white/50'}>EN</span>
            <span className="text-white/20">|</span>
            <span className={locale === 'ja' ? 'text-accent-gold' : 'text-white/50'}>JP</span>
        </button>
    );
};
