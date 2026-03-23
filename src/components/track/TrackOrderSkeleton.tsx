'use client'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function TrackOrderSkeleton() {
    return (
        <div className="container mx-auto px-4 py-32 max-w-6xl">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 bg-white/5 rounded-full" />
                    <Skeleton className="h-16 w-64 bg-white/5 rounded-2xl" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-40 bg-white/5 rounded-full" />
                        <Skeleton className="h-4 w-32 bg-white/5 rounded-full" />
                    </div>
                </div>
                <Skeleton className="h-20 w-48 bg-white/5 rounded-[2rem]" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Content Skeleton */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-neutral-900 p-10">
                            <div className="flex justify-between items-center">
                                <div className="space-y-4">
                                    <Skeleton className="h-10 w-48 bg-white/10 rounded-xl" />
                                    <Skeleton className="h-6 w-64 bg-white/10 rounded-lg" />
                                </div>
                                <Skeleton className="h-16 w-16 bg-white/10 rounded-3xl" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 space-y-12">
                            <div className="space-y-10 py-10">
                                <Skeleton className="h-3 w-full bg-neutral-100 rounded-full" />
                                <div className="flex justify-between">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="flex flex-col items-center gap-4">
                                            <Skeleton className="h-14 w-14 bg-neutral-50 rounded-2xl" />
                                            <Skeleton className="h-3 w-12 bg-neutral-50 rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Skeleton className="h-40 w-full bg-neutral-50 rounded-[2rem]" />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Skeleton */}
                <div className="space-y-8">
                    <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
                        <div className="p-8 bg-neutral-50 border-b flex justify-between items-center">
                            <Skeleton className="h-8 w-40 bg-neutral-200 rounded-xl" />
                        </div>
                        <div className="p-8 space-y-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-5 w-5 bg-neutral-100 rounded-md" />
                                        <Skeleton className="h-5 w-32 bg-neutral-100 rounded-md" />
                                    </div>
                                    <Skeleton className="h-5 w-16 bg-neutral-100 rounded-md" />
                                </div>
                            ))}
                            <div className="pt-6 border-t border-dashed border-neutral-200 space-y-4">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-6 w-24 bg-neutral-100 rounded-md" />
                                    <Skeleton className="h-6 w-20 bg-neutral-100 rounded-md" />
                                </div>
                                <div className="flex justify-between items-center pt-4">
                                    <Skeleton className="h-8 w-32 bg-neutral-100 rounded-md" />
                                    <Skeleton className="h-10 w-24 bg-accent-gold/20 rounded-md" />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
