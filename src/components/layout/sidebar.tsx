"use client"

import Link from "next/link"
import {
  Package2,
  Users2,
  ShoppingCart,
  LayoutGrid,
  Rows4,
  Package,
} from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"

export const NAV_LINKS = [
  { href: "/restaurant/pos-orders", label: "POS Orders", icon: ShoppingCart },
  { href: "/restaurant/products", label: "Products", icon: Package },
  { href: "/restaurant/customers", label: "Customers", icon: Users2 },
  { href: "/restaurant/floors", label: "Floors", icon: LayoutGrid },
  { href: "/restaurant/tables", label: "Tables", icon: Rows4 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <TooltipProvider>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/restaurant/pos-orders"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">Odoo Manager</span>
          </Link>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                    pathname.startsWith(href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
