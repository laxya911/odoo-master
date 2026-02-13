"use client";
import React from "react";
import { CartProvider } from "@/context/CartContext";
import { Cart } from "@/components/menu/Cart";
import { Toaster } from "@/components/ui/toaster";

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        <aside className="w-full max-w-sm border-l bg-muted/40">
          <Cart />
        </aside>
      </div>
      <Toaster />
    </CartProvider>
  );
}