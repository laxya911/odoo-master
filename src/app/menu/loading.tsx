import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-4">
              <Skeleton className="aspect-square w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2 p-4 pt-0">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-1/3" />
            </div>
            <div className="flex items-center p-4 pt-0">
               <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}