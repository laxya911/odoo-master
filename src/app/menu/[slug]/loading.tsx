import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
    return (
        <div className="min-h-screen bg-neutral-950 pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Image Skeleton */}
                    <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-white/5 animate-pulse">
                        <Skeleton className="w-full h-full bg-neutral-900" />
                    </div>

                    {/* Content Skeleton */}
                    <div className="space-y-8 py-4">
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-24 bg-white/5 rounded-full" />
                            <Skeleton className="h-12 w-3/4 bg-white/5 rounded-2xl" />
                            <Skeleton className="h-6 w-1/4 bg-white/5 rounded-xl" />
                        </div>

                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full bg-white/5 rounded-md" />
                            <Skeleton className="h-4 w-full bg-white/5 rounded-md" />
                            <Skeleton className="h-4 w-2/3 bg-white/5 rounded-md" />
                        </div>

                        <div className="pt-8 border-t border-white/10 space-y-6">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-10 w-32 bg-white/5 rounded-2xl" />
                                <Skeleton className="h-12 w-48 bg-white/5 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
