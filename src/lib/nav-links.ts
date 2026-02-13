import {
  ShoppingCart,
  Package,
  Users2,
  LayoutGrid,
  Rows4,
  MenuSquare,
} from "lucide-react";

export const NAV_LINKS = [
  { href: "/menu", label: "Self-Order Menu", icon: MenuSquare },
  { href: "/restaurant/pos-orders", label: "POS Orders", icon: ShoppingCart },
  { href: "/restaurant/products", label: "Products", icon: Package },
  { href: "/restaurant/customers", label: "Customers", icon: Users2 },
  { href: "/restaurant/floors", label: "Floors", icon: LayoutGrid },
  { href: "/restaurant/tables", label: "Tables", icon: Rows4 },
];