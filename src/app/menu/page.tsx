import { Suspense } from 'react';
import type { Paginated, OdooError, OdooRecord } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import MenuLoading from './loading';
import { Menu } from '@/sections/Menu';

async function getProducts(): Promise<Paginated<OdooRecord> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/restaurant/products`);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorBody: Record<string, unknown> | null = null;
      let errorMessage: string;
      if (contentType && contentType.includes("application/json")) {
        const body = await res.json() as Record<string, unknown>;
        errorBody = body;
        errorMessage = (body.message as string) || 'An unknown API error occurred';
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


export default async function MenuPage() {
  const productsData = await getProducts();

  if ('error' in productsData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Fetching Products</AlertTitle>
          <AlertDescription>
            <p>{productsData.error.message}</p>
            {!!productsData.error.odooError && <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-destructive/20 p-2 text-xs">{JSON.stringify(productsData.error.odooError, null, 2)}</pre>}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Suspense fallback={<MenuLoading />}>
      <main role="main" className=' mx-auto bg-neutral-950'>
        <Menu />
      </main>
    </Suspense>
  );
}