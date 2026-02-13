import { Suspense } from 'react';
import { CustomersClient } from './customers-client';
import { CustomersLoading } from './loading';
import type { Paginated, Partner, OdooError } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

async function getCustomers(searchParams: URLSearchParams): Promise<Paginated<Partner> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/partners`);
  url.search = searchParams.toString();

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorMessage;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorBody = await res.json();
        errorMessage = errorBody.message || 'An unknown API error occurred';
      } else {
        errorMessage = await res.text();
      }
      return { error: { message: errorMessage, status: res.status } };
    }
    return res.json();
  } catch (e) {
    const error = e as Error;
    return { error: { message: error.message, status: 500 } };
  }
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = new URLSearchParams(JSON.parse(JSON.stringify(searchParams)));
  const customersData = await getCustomers(params);

  if ('error' in customersData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error fetching customers</AlertTitle>
        <AlertDescription>{customersData.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<CustomersLoading />}>
      <CustomersClient initialData={customersData} />
    </Suspense>
  );
}
