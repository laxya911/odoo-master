import { Suspense } from 'react';
import { PosOrdersClient } from './orders-client';
import { PosOrdersLoading } from './loading';
import type { Paginated, PosOrder, OdooError } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

async function getPosOrders(searchParams: URLSearchParams): Promise<Paginated<PosOrder> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/pos/orders`);
  url.search = searchParams.toString();

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
     if (!res.ok) {
      const errorBody = await res.json();
      return { error: { message: errorBody.error.message, status: res.status } };
    }
    return res.json();
  } catch (e) {
    const error = e as Error;
    return { error: { message: error.message, status: 500 } };
  }
}

export default async function PosOrdersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      params.set(key, String(value));
    }
  }

  const ordersData = await getPosOrders(params);

  if ('error' in ordersData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error fetching POS Orders</AlertTitle>
        <AlertDescription>{ordersData.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<PosOrdersLoading />}>
      <PosOrdersClient initialData={ordersData} />
    </Suspense>
  );
}
