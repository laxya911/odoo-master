"use client";

import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

export function Cart() {
  const { cartItems, getCartTotal, updateItemQuantity, removeFromCart, updateItemNotes, clearCart } = useCart();
  const total = getCartTotal();
  
  const handleNoteChange = useDebouncedCallback((cartItemId: string, notes: string) => {
    updateItemNotes(cartItemId, notes);
  }, 500);

  const handleCheckout = () => {
    // TODO: Implement server action for checkout
    // 1. Call a server action with the cartItems payload
    // 2. The server action will call Odoo to create a pos.order
    // 3. Handle success or error response
    alert("Checkout functionality is not yet implemented.");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-6">
        <h2 className="text-2xl font-bold">My Order</h2>
        {cartItems.length > 0 && (
           <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive">
            Clear All
          </Button>
        )}
      </div>
      <Separator />

      {cartItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <p className="text-sm text-muted-foreground">Add items from the menu to get started.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-6">
            {cartItems.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                   <Image
                      src={item.product.image_256 ? `data:image/png;base64,${item.product.image_256}` : "https://picsum.photos/seed/fooditem/100"}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                   />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{item.product.name}</p>
                  <p className="text-sm font-bold text-muted-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD"}).format(item.product.list_price)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item.id, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item.id, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                   <Input 
                      type="text" 
                      placeholder="Add a note..." 
                      defaultValue={item.notes}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className="mt-2 text-sm h-9"
                    />
                </div>
                 <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.id)}>
                    <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="mt-auto border-t p-6">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD"}).format(total)}</span>
        </div>
        <p className="text-right text-xs text-muted-foreground">Taxes calculated at checkout</p>
        <Button
          size="lg"
          className="w-full mt-4"
          disabled={cartItems.length === 0}
          onClick={handleCheckout}
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
