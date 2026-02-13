import { Suspense } from 'react';
import { PosOrdersClient } from './client';
import { PosOrdersLoading } from './loading';
import type { Paginated, OdooRecord, OdooError } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

async function getPosOrders(searchParams: URLSearchParams): Promise<Paginated<OdooRecord> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/restaurant/pos-orders`);
  url.search = searchParams.toString();

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorBody: any;
      let errorMessage: string;
      if (contentType && contentType.includes("application/json")) {
        errorBody = await res.json();
        errorMessage = errorBody.message || 'An unknown API error occurred';
      } else {
        errorMessage = await res.text();
      }
      return { error: { message: errorMessage, status: res.status, odooError: errorBody } };
    }
    return res.json();
  } catch (e) {
    const error = e as Error;
    return { error: { message: error.message, status: 500 } };
  }
}

export default async function RestaurantPosOrdersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = new URLSearchParams(JSON.parse(JSON.stringify(searchParams)));
  const ordersData = await getPosOrders(params);

  if ('error' in ordersData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Fetching POS Orders</AlertTitle>
        <AlertDescription>
          <p>{ordersData.error.message}</p>
          {ordersData.error.odooError && <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-destructive/20 p-2 text-xs">{JSON.stringify(ordersData.error.odooError, null, 2)}</pre>}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<PosOrdersLoading />}>
      <PosOrdersClient initialData={ordersData} />
    </Suspense>
  );
}
