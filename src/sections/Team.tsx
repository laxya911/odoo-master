
"use client"
import Image from 'next/image';
import Link from 'next/link';
import { STAFF } from '@/lib/odoo-mock';
import { Button } from '@/components/ui/button';
import { Instagram, Facebook, Award, Star, Mail, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TeamPage() {
    return (
        <div className="container mx-auto px-12 py-20">
            <div className="text-center mb-10 space-y-6">
                <Badge className="bg-accent-gold/60 border-accent-gold/60 px-6 py-2 rounded-full text-xs  uppercase">The RAM Family</Badge>
                <h1 className="text-7xl font-black font-headline tracking-tighter leading-none">Meet Our <span className="text-accent-gold italic">Masters</span></h1>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">The talented hands and passionate hearts behind every authentic Himalayan dish served in Ibaraki since 1999.</p>
                <div className="w-32 h-2 bg-accent-gold mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {STAFF.map((member) => (
                    <div key={member.id} className="group bg-white rounded-[1rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-primary/5 flex flex-col">
                        <div className="relative h-[350px] w-full overflow-hidden">
                            <Image src={member.image} alt={member.name} fill className="object-fit-cover group-hover:scale-110 transition-transform duration-1000" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                            <div className="absolute top-6 right-6 flex flex-col gap-3">
                                {member.socials.instagram && (
                                    <Link href={member.socials.instagram} target="_blank">
                                        <Button variant="outline" size="icon" className="rounded-2xl shadow-xl hover:bg-accent-gold hover:text-white transition-all">
                                            <Instagram className="w-5 h-5" />
                                        </Button>
                                    </Link>
                                )}
                                {member.socials.facebook && (
                                    <Link href={member.socials.facebook} target="_blank">
                                        <Button variant="outline" size="icon" className="rounded-2xl shadow-xl hover:bg-primary hover:text-white transition-all hover:bg-accent-gold">
                                            <Facebook className="w-5 h-5" />
                                        </Button>
                                    </Link>
                                )}
                            </div>

                            <div className="absolute bottom-8 left-6 right-6">
                                <p className=" font-black text-[10px] uppercase tracking-[0.4em] mb-1">{member.designationJp}</p>
                                <h3 className=" text-3xl font-bold font-headline">{member.name}</h3>
                                <p className="text-xs font-medium mt-1">{member.designation}</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 space-y-4 flex-1 flex flex-col justify-between">
                            <p className=" text-black italic border-l-2 border-primary/20 pl-4">
                                "{member.bio}"
                            </p>

                            <div className="pt-4 border-t border-dashed flex items-center justify-between">
                                <div className="flex gap-1 text-accent-gold">
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-full text-accent text-[10px]  uppercase tracking-widest gap-2 bg-accent-gold  transition-all">
                                    <Mail className="w-3.5 h-3.5" />
                                    Contact
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-28 p-12 bg-[#121212] rounded-[4rem] text-white overflow-hidden relative group">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                    <div className="bg-accent-gold/20 p-6 rounded-[2.5rem] backdrop-blur-md">
                        <Award className="w-16 h-16 text-accent-gold" />
                    </div>
                    <h2 className="text-5xl font-black font-headline max-w-2xl leading-tight">Join Our Culinary Elite</h2>
                    <p className="text-xl text-white/60 max-w-xl leading-relaxed">We're always looking for passionate chefs who understand the intricate art of Indian and Nepalese spices.</p>
                    <Button size="lg" variant="outline" className="rounded-full bg-accent-gold px-12 h-16 text-lg font-black shadow-2xl hover:scale-105 transition-transform">
                        Apply Now
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
