import { Suspense } from 'react';
import { PosConfigsClient } from './configs-client';
import { PosConfigsLoading } from './loading';
import type { Paginated, PosConfig, OdooError } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

async function getPosConfigs(searchParams: URLSearchParams): Promise<Paginated<PosConfig> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/pos/configs`);
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

export default async function PosConfigsPage({
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
  
  const configsData = await getPosConfigs(params);

  if ('error' in configsData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error fetching POS Configurations</AlertTitle>
        <AlertDescription>{configsData.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<PosConfigsLoading />}>
      <PosConfigsClient initialData={configsData} />
    </Suspense>
  );
}
