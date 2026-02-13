"use client";

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
import type { Paginated, PosConfig } from "@/lib/types";
import { PaginationControls } from "@/components/pagination";

type PosConfigsClientProps = {
  initialData: Paginated<PosConfig>;
};

export function PosConfigsClient({ initialData }: PosConfigsClientProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active POS Configurations</CardTitle>
        <CardDescription>A list of active Point of Sale configurations in Odoo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Journal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.data.length > 0 ? (
                initialData.data.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="text-muted-foreground">{config.company_id ? config.company_id[1] : 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{config.journal_id ? config.journal_id[1] : 'N/A'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No active POS configurations found.
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
