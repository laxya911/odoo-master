import { Suspense } from 'react';
import { ProductsClient } from './products-client';
import { ProductsLoading } from './loading';
import type { Paginated, Product, OdooError } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

async function getProducts(searchParams: URLSearchParams): Promise<Paginated<Product> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/products`);
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = new URLSearchParams(searchParams as Record<string, string>);
  const productsData = await getProducts(params);

  if ('error' in productsData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error fetching products</AlertTitle>
        <AlertDescription>{productsData.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsClient initialData={productsData} />
    </Suspense>
  );
}
