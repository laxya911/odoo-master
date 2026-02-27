"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    total: number;
    limit: number;
    offset: number;
    [key: string]: any;
}

export function PaginationControls({ total, limit, offset }: PaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    const createPageUrl = (newOffset: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("offset", newOffset.toString());
        return `${pathname}?${params.toString()}`;
    };

    const handlePageChange = (newOffset: number) => {
        router.push(createPageUrl(newOffset));
    };

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between px-2">
            <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{offset + 1}</span> to{" "}
                <span className="font-medium text-foreground">
                    {Math.min(offset + limit, total)}
                </span>{" "}
                of <span className="font-medium text-foreground">{total}</span> results
            </div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                </Button>
                <div className="flex items-center justify-center text-sm font-medium">
                    Page {currentPage} of {totalPages}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(offset + limit)}
                    disabled={offset + limit >= total}
                >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
}
