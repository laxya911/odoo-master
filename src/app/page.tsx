import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { NAV_LINKS } from "@/lib/nav-links";

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="flex h-16 items-center justify-end border-b bg-background px-6">
        <h1 className="text-lg font-semibold">My Company (San Francisco)</h1>
      </header>
      <main className="flex-1 p-6 sm:p-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className="flex flex-col items-center text-center group">
              <Card className="h-32 w-32 rounded-lg transition-all group-hover:scale-105 group-hover:shadow-xl">
                <CardContent className="flex h-full items-center justify-center p-6">
                  <Icon className="h-10 w-10 text-primary" />
                </CardContent>
              </Card>
              <span className="mt-2 text-sm font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
