'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ProductSkeletonProps {
    className?: string
}

export const ProductSkeleton = ({ className }: ProductSkeletonProps) => {
    return (
        <div className={cn(
            "bg-neutral-900/40 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col h-full",
            className
        )}>
            {/* Image Area */}
            <div className="relative h-64 overflow-hidden bg-neutral-800">
                <Skeleton className="w-full h-full bg-neutral-800" />
            </div>

            {/* Content Area */}
            <div className="p-6 flex flex-col flex-grow space-y-4">
                <div className="flex justify-between items-start gap-2">
                    <Skeleton className="h-6 w-2/3 bg-white/5 rounded-lg" />
                    <Skeleton className="h-6 w-1/4 bg-white/5 rounded-lg" />
                </div>

                <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-white/5 rounded-md opacity-60" />
                    <Skeleton className="h-4 w-3/4 bg-white/5 rounded-md opacity-60" />
                </div>

                <div className="mt-auto flex gap-3 pt-4">
                    <Skeleton className="h-12 flex-grow bg-white/5 rounded-2xl" />
                    <Skeleton className="h-12 w-12 bg-white/5 rounded-full shrink-0" />
                </div>
            </div>
        </div>
    )
}
