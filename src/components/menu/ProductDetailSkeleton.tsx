'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function ProductDetailSkeleton() {
    return (
        <div className="min-h-screen bg-neutral-950 pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Hero Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Image Skeleton */}
                    <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-white/5">
                        <Skeleton className="w-full h-full bg-neutral-900" />
                    </div>

                    {/* Info Skeleton */}
                    <div className="space-y-8 py-4">
                        <div className="space-y-6">
                            <Skeleton className="h-6 w-24 bg-white/5 rounded-full" />
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-3/4 bg-white/5 rounded-2xl" />
                                <Skeleton className="h-16 w-1/2 bg-white/5 rounded-2xl" />
                            </div>
                            <Skeleton className="h-8 w-32 bg-white/5 rounded-xl" />
                        </div>

                        <div className="space-y-4 pt-8 border-t border-white/5">
                            <Skeleton className="h-4 w-full bg-white/5 rounded-md" />
                            <Skeleton className="h-4 w-full bg-white/5 rounded-md" />
                            <Skeleton className="h-4 w-2/3 bg-white/5 rounded-md" />
                        </div>

                        <div className="pt-12 space-y-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-12 w-32 bg-white/5 rounded-2xl" />
                                <Skeleton className="h-16 w-56 bg-accent-gold/10 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Suggestions Section Skeleton */}
                <div className="mt-32 space-y-12">
                    <div className="flex items-end justify-between border-b border-white/5 pb-8">
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-32 bg-white/5 rounded-lg" />
                            <Skeleton className="h-10 w-64 bg-white/5 rounded-xl" />
                        </div>
                        <Skeleton className="h-6 w-24 bg-white/5 rounded-lg hidden md:block" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-4xl bg-white/5 animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
