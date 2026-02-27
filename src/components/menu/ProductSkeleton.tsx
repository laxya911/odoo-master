'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const ProductSkeleton = () => {
    return (
        <div className="bg-neutral-900/40 rounded-[32px] border border-white/5 overflow-hidden flex flex-col h-[400px] md:h-[480px]">
            <div className="relative h-48 md:h-64 overflow-hidden">
                <Skeleton className="w-full h-full bg-neutral-800" />
            </div>
            <div className="p-6 md:p-8 flex flex-col flex-grow space-y-4">
                <div className="flex justify-between items-start">
                    <Skeleton className="h-7 w-2/3 bg-neutral-800 rounded-lg" />
                    <Skeleton className="h-7 w-1/4 bg-neutral-800 rounded-lg" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-neutral-800 rounded-md" />
                    <Skeleton className="h-4 w-4/5 bg-neutral-800 rounded-md" />
                </div>
                <div className="mt-auto flex gap-2">
                    <Skeleton className="h-10 flex-grow bg-neutral-800 rounded-2xl" />
                    <Skeleton className="h-10 w-1/3 bg-neutral-800 rounded-2xl" />
                </div>
            </div>
        </div>
    )
}
