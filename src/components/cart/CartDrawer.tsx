'use client'

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Cart } from '@/components/menu/Cart'
import { useCart } from '@/context/CartContext'
import { CheckoutDialog } from '@/components/menu/CheckoutDialog'
import { useTranslations } from 'next-intl'

export function CartDrawer() {
    const { isCartOpen, setIsCartOpen, isCheckoutOpen, setIsCheckoutOpen, cartItems, getCartBreakdown } = useCart()
    const { total, subtotal, tax } = getCartBreakdown()

    return (
        <>
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetContent className="w-full sm:max-w-sm p-0 flex flex-col h-full border-l border-white/20 glass shadow-2xl">
                    <SheetHeader className="sr-only">
                        <SheetTitle>{useTranslations('cart')('title')}</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden">
                        <Cart />
                    </div>
                </SheetContent>
            </Sheet>

            <CheckoutDialog
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                cartItems={cartItems}
                total={total}
                subtotal={subtotal}
                totalTax={tax}
            />
        </>
    )
}
