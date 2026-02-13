import {
  ShoppingCart,
  Package,
  Users2,
  LayoutGrid,
  Rows4,
} from "lucide-react";

export const NAV_LINKS = [
  { href: "/restaurant/pos-orders", label: "POS Orders", icon: ShoppingCart },
  { href: "/restaurant/products", label: "Products", icon: Package },
  { href: "/restaurant/customers", label: "Customers", icon: Users2 },
  { href: "/restaurant/floors", label: "Floors", icon: LayoutGrid },
  { href: "/restaurant/tables", label: "Tables", icon: Rows4 },
];
