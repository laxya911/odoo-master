'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function AuthSkeleton() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4 py-20">
            <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl border-none overflow-hidden animate-pulse">
                {/* Header Skeleton */}
                <div className="bg-neutral-800 p-10 flex flex-col items-center gap-6">
                    <Skeleton className="w-16 h-16 rounded-3xl bg-white/10" />
                    <div className="space-y-3 w-full flex flex-col items-center">
                        <Skeleton className="h-8 w-1/2 bg-white/10 rounded-lg" />
                        <Skeleton className="h-4 w-2/3 bg-white/10 rounded-md" />
                    </div>
                </div>

                {/* Content Skeleton */}
                <CardContent className="p-10 space-y-10">
                    <div className="grid w-full grid-cols-2 gap-4 bg-neutral-50 p-1.5 rounded-full">
                        <Skeleton className="h-10 rounded-full bg-neutral-200" />
                        <div className="h-10 rounded-full bg-transparent" />
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 bg-neutral-100 rounded-md" />
                            <Skeleton className="h-12 w-full bg-neutral-50 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 bg-neutral-100 rounded-md" />
                            <Skeleton className="h-12 w-full bg-neutral-50 rounded-xl" />
                        </div>
                        <Skeleton className="h-12 w-full bg-neutral-100 rounded-2xl" />
                    </div>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <Skeleton className="w-full h-[1px] bg-neutral-100" />
                        </div>
                        <div className="relative flex justify-center">
                            <Skeleton className="h-4 w-12 bg-white rounded-md" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-12 rounded-xl bg-neutral-50" />
                        <Skeleton className="h-12 rounded-xl bg-neutral-50" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
