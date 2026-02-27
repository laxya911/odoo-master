"use client"

import { CreditCard, Smartphone, Banknote } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PaymentGatewayProps {
    onMethodChange: (method: string) => void;
    currentMethod: string;
}

export function PaymentGateway({ onMethodChange, currentMethod }: PaymentGatewayProps) {
    return (
        <div className="space-y-6">
            <RadioGroup
                defaultValue="card"
                value={currentMethod}
                onValueChange={(val) => onMethodChange(val)}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
                <label className={`flex items-center gap-3 p-5 border-2 rounded-[2rem] cursor-pointer transition-all ${currentMethod === 'card' ? 'border-accent-gold bg-accent-gold/5' : 'border-neutral-100 bg-white hover:border-neutral-200'}`}>
                    <RadioGroupItem value="card" id="card" className="sr-only" />
                    <div className={`p-3 rounded-xl ${currentMethod === 'card' ? 'bg-accent-gold text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Credit / Debit Card</p>
                        <p className="text-[10px] text-muted-foreground">Secure via Stripe</p>
                    </div>
                </label>

                <label className={`flex items-center gap-3 p-5 border-2 rounded-[2rem] cursor-pointer transition-all ${currentMethod === 'cash' ? 'border-accent-gold bg-accent-gold/5' : 'border-neutral-100 bg-white hover:border-neutral-200'}`}>
                    <RadioGroupItem value="cash" id="cash" className="sr-only" />
                    <div className={`p-3 rounded-xl ${currentMethod === 'cash' ? 'bg-accent-gold text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        <Banknote className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Cash on Delivery</p>
                        <p className="text-[10px] text-muted-foreground">Pay when it arrives</p>
                    </div>
                </label>

                <label className={`flex items-center gap-3 p-5 border-2 rounded-[2rem] cursor-pointer transition-all opacity-50 grayscale cursor-not-allowed`}>
                    <RadioGroupItem value="mobile" id="mobile" disabled className="sr-only" />
                    <div className="p-3 rounded-xl bg-neutral-100 text-neutral-500">
                        <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Digital Wallets</p>
                        <p className="text-[10px] text-muted-foreground">Coming Soon</p>
                    </div>
                </label>
            </RadioGroup>
        </div>
    );
}
