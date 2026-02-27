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
import type { Paginated, OdooRecord } from "@/lib/types";
import { PaginationControls } from "@/components/pagination";
import { DateRangePicker } from "@/components/ui/date-range-picker";

type PosOrdersClientProps = {
  initialData: Paginated<OdooRecord>;
};

const renderCellContent = (value: unknown) => {
  if (value === false || value === null || value === undefined) {
    return <span className="text-muted-foreground">N/A</span>;
  }
  if (typeof value === 'boolean') {
    return <Badge variant={value ? 'secondary' : 'outline'}>{value ? 'Yes' : 'No'}</Badge>;
  }
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'string') {
    return <span title={`ID: ${value[0]}`}>{value[1]}</span>;
  }
  if (Array.isArray(value)) {
    return <span className="text-xs">{value.join(', ')}</span>;
  }
  if (typeof value === 'object') {
    return <pre className="text-xs bg-muted p-1 rounded-sm max-w-xs overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
  }
  return String(value);
};

export function PosOrdersClient({ initialData }: PosOrdersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

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

  const headers = initialData.data.length > 0 ? Object.keys(initialData.data[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>POS Orders</CardTitle>
        <CardDescription>
          {`Displaying ${initialData.data.length} of ${initialData.meta.total} orders from Odoo model: ${initialData.meta.model}`}
        </CardDescription>
        <div className="flex items-center gap-2 pt-4">
          <DateRangePicker date={date} onDateChange={setDate} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map(header => (
                  <TableHead key={header} className="whitespace-nowrap capitalize">{header.replace(/_/g, ' ')}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.data.length > 0 ? (
                initialData.data.map((record) => (
                  <TableRow key={record.id}>
                    {headers.map(header => (
                      <TableCell key={`${record.id}-${header}`} className="whitespace-nowrap">
                        {renderCellContent(record[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
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
