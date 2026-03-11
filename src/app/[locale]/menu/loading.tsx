import { ProductSkeleton } from "@/components/menu/ProductSkeleton";

export default function MenuLoading() {
  return (
    <div className="container mx-auto px-6 pt-24 pb-24 bg-neutral-950 min-h-screen">
      {/* Hero Skeleton Placeholder */}
      <div className="max-w-4xl mb-12 space-y-4">
        <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse" />
        <div className="h-16 w-3/4 bg-white/5 rounded-2xl animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}