import { Suspense } from 'react';
import { getRestaurantProducts } from '@/lib/odoo-products';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import MenuLoading from './loading';
import { Menu } from '@/sections/Menu';

import { OdooClientError } from '@/lib/odoo-client';

async function getProducts() {
  try {
    return await getRestaurantProducts({ limit: 1000 });
  } catch (e) {
    if (e instanceof OdooClientError) {
      return { error: { message: e.message, status: e.status, odooError: e.odooError } };
    }
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