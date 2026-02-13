"use client";

import { useState, useTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Paginated, PosOrder } from "@/lib/types";
import { PaginationControls } from "@/components/pagination";
import { DateRangePicker } from "@/components/ui/date-range-picker";

type PosOrdersClientProps = {
  initialData: Paginated<PosOrder>;
};

export function PosOrdersClient({ initialData }: PosOrdersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('start_date');
    const to = searchParams.get('end_date');
    if (from || to) {
      return { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined };
    }
    return undefined;
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (date?.from) {
      params.set("start_date", format(date.from, 'yyyy-MM-dd'));
    } else {
      params.delete("start_date");
    }
    if (date?.to) {
      params.set("end_date", format(date.to, 'yyyy-MM-dd'));
    } else {
      params.delete("end_date");
    }
    params.set("offset", "0");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [date, router, pathname, searchParams]);

  const getStateBadgeVariant = (state: PosOrder['state']) => {
    switch (state) {
      case 'paid':
      case 'done':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'invoiced':
        return 'default';
      case 'cancel':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>POS Orders</CardTitle>
        <CardDescription>View and filter Point of Sale orders by date.</CardDescription>
        <div className="flex items-center gap-2 pt-4">
          <DateRangePicker date={date} onDateChange={setDate} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.data.length > 0 ? (
                initialData.data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.name}</TableCell>
                    <TableCell>{new Date(order.date_order).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{order.partner_id ? order.partner_id[1] : 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{order.session_id ? order.session_id[1] : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(order.amount_total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getStateBadgeVariant(order.state)} className="capitalize">{order.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No orders found for the selected period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <PaginationControls {...initialData.meta} />
        </div>
      </CardContent>
    </Card>
  );
}
