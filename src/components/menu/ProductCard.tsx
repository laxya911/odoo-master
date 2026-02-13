"use client";

import type { Product } from "@/lib/types";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const hasVariants = product.attribute_line_ids && product.attribute_line_ids.length > 0;

  const handleAddToCart = () => {
    // TODO: If hasVariants, open a modal to select options.
    // For now, we just add simple products directly.
    if (!hasVariants) {
      addToCart(product);
    } else {
        // This is where you would trigger a modal
        // For now, we'll just add the base product as a placeholder action
        addToCart(product);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative aspect-square w-full">
          <Image
            src={product.image_256 ? `data:image/png;base64,${product.image_256}` : "https://picsum.photos/seed/food/400"}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          />
        </div>
      </CardHeader>
      <div className="flex flex-1 flex-col p-4">
        <CardTitle className="mb-2 text-lg font-semibold">{product.name}</CardTitle>
        <p className="flex-1 text-lg font-bold text-primary">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD", // TODO: Make currency dynamic from Odoo settings
          }).format(product.list_price)}
        </p>
      </div>
      <CardFooter className="p-4 pt-0">
        <Button onClick={handleAddToCart} className="w-full">
          <PlusCircle className="mr-2 h-5 w-5" />
          {hasVariants ? "Customize" : "Add to Order"}
        </Button>
      </CardFooter>
    </Card>
  );
}