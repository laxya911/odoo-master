'use client'
import React from 'react';
import { STAFF } from '@/lib/data';
import { Instagram, Mail, ArrowRight, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';

export const Team: React.FC = () => {
    const t = useTranslations('team');
    const { translate } = useDynamicTranslation();

    return (
        <section id="team" className="py-24 bg-neutral-950 relative overflow-hidden">
            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                    <div className="max-w-xl">
                        <Badge variant="outline" className="text-accent-gold border-accent-gold/30 mb-4 px-4 py-1">
                            {t('subtitle')}
                        </Badge>
                        <h2 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tight italic">
                            {t('title')}
                        </h2>
                        <p className="text-white/60 mt-6 leading-relaxed text-lg italic">
                            &quot;{t('desc')}&quot;
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {STAFF.map((member) => (
                        <Card key={member.id} className="bg-white/5 border-white/10 hover:border-accent-gold/50 transition-all group overflow-hidden">
                            <CardContent className="p-0">
                                <div className="relative aspect-[3/4] overflow-hidden">
                                    <div className="absolute inset-0 bg-neutral-950/20 group-hover:bg-transparent transition-colors z-10" />
                                    <Image
                                        src={member.image}
                                        alt={member.name}
                                        width={500}
                                        height={500}
                                        className="absolute inset-0 w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neutral-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                                    <div className="absolute bottom-8 left-0 right-0 z-20 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                        <div className="flex gap-4 justify-center">
                                            <Link href="#" className="w-12 h-12 rounded-full bg-neutral-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-accent-gold hover:text-neutral-900 hover:border-accent-gold hover:scale-110 transition-all duration-300 shadow-xl">
                                                <Instagram className="w-6 h-6" />
                                            </Link>
                                            <Link href="#" className="w-12 h-12 rounded-full bg-neutral-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-accent-gold hover:text-neutral-900 hover:border-accent-gold hover:scale-110 transition-all duration-300 shadow-xl">
                                                <Mail className="w-6 h-6" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-display font-medium text-white group-hover:text-accent-gold transition-colors">{translate(member.name)}</h3>
                                            <p className="text-accent-gold text-xs font-bold uppercase tracking-widest mt-1">
                                                {member.designation === 'Executive Chef' ? t('founder') : t('chef')}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-white/60 text-sm leading-relaxed italic">
                                        {translate(member.bio)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                </div>

                <div className="mt-28 p-12 bg-[#121212] rounded-[4rem] text-white overflow-hidden relative group">
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                        <div className="bg-accent-gold/20 p-6 rounded-[2.5rem] backdrop-blur-md">
                            <Award className="w-16 h-16 text-accent-gold" />
                        </div>
                        <h3 className="text-5xl font-black font-headline max-w-2xl leading-tight">{t('joinTitle')}</h3>
                        <p className="text-xl text-white/60 max-w-xl leading-relaxed">{t('joinDesc')}</p>
                        <Button size="lg" variant="outline" className="rounded-full bg-accent-gold px-12 h-16 text-lg font-black shadow-2xl hover:scale-105 transition-transform">
                            {t('applyNow')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};
