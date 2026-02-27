'use client'

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Cart } from '@/components/menu/Cart'
import { useCart } from '@/context/CartContext'

export function CartDrawer() {
    const { isCartOpen, setIsCartOpen } = useCart()

    return (
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetContent className="w-full sm:max-w-sm p-0 flex flex-col h-full border-l border-white/20 glass shadow-2xl">
                <SheetHeader className="sr-only">
                    <SheetTitle>Your Cart</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-hidden">
                    <Cart />
                </div>
            </SheetContent>
        </Sheet>
    )
}
