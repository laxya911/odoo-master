"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Paginated, OdooRecord } from "@/lib/types";
import { PaginationControls } from "@/components/pagination";

type TablesClientProps = {
  initialData: Paginated<OdooRecord>;
  floors: OdooRecord[];
};

const renderCellContent = (value: any) => {
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

export function TablesClient({ initialData, floors }: TablesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFloorChange = (floorId: string) => {
    const params = new URLSearchParams(searchParams);
    if (floorId === "all") {
      params.delete("floor_id");
    } else {
      params.set("floor_id", floorId);
    }
    params.set("offset", "0");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const headers = initialData.data.length > 0 ? Object.keys(initialData.data[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurant Tables</CardTitle>
        <CardDescription>
          {`Displaying ${initialData.data.length} of ${initialData.meta.total} tables from Odoo model: ${initialData.meta.model}`}
        </CardDescription>
         <div className="flex items-center gap-2 pt-4">
          <Select
            onValueChange={handleFloorChange}
            defaultValue={searchParams.get("floor_id") || "all"}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map(floor => (
                <SelectItem key={floor.id} value={String(floor.id)}>{floor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    No tables found.
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
