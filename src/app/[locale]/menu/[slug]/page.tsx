import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
import { getRestaurantProducts, getRestaurantProductDetails } from '@/lib/odoo-products';
import { ProductView } from '@/components/menu/ProductView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { generateSlug } from '@/lib/utils';
import type { Product } from '@/lib/types';

import { OdooClientError } from '@/lib/odoo-client';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

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

async function getProductDetails(id: number) {
  try {
    return await getRestaurantProductDetails(id);
  } catch (e) {
    return null;
  }
}

// generateStaticParams is removed because it attempts to fetch from Odoo at build-time,
// which failed recently due to connectivity issues. force-dynamic ensures fresh data.

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'menu' });
  const tDynamic = await getTranslations({ locale, namespace: 'dynamic' });
  
  const translate = (key: string | undefined): string => {
    if (!key) return '';
    const sanitizedKey = key.replace(/\./g, '_');
    return tDynamic.has(sanitizedKey) ? tDynamic(sanitizedKey) : key;
  };

  const productsData = await getProducts();

  if ('error' in productsData) {
    return { title: `${t('productNotFound')} | RAM Dining` };
  }

  const products = productsData.data as Product[];
  const product = products.find(p => generateSlug(p.name) === slug);

  if (!product) return { title: `${t('productNotFound')} | RAM Dining` };

  return {
    title: `${translate(product.name)} | RAM Dining`,
    description: translate(typeof product.description_sale === 'string' ? product.description_sale : `Order ${product.name} from RAM Dining.`),
    openGraph: {
      title: translate(product.name),
      description: translate(typeof product.description_sale === 'string' ? product.description_sale : ''),
      images: product.image_256 ? [{ url: `data:image/png;base64,${product.image_256}` }] : [],
    }
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'menu' });
  const productsData = await getProducts();

  if ('error' in productsData) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('productNotFound')}</AlertTitle>
          <AlertDescription>{productsData.error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const products = productsData.data as Product[];
  const product = products.find(p => generateSlug(p.name) === slug);

  if (!product) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">{t('productNotFound')}</h1>
          <p className="text-neutral-400">{t('productNotFoundDesc')}</p>
        </div>
      </div>
    );
  }

  // Fetch full details (attributes, combos, description, etc.)
  const details = await getProductDetails(product.id);
  const fullProduct = { ...product, ...details };

  // Get related items (same category or random)
  const relatedItems = products
    .filter(p => p.id !== product.id)
    .slice(0, 3);

  return (
    <div className="bg-neutral-950">
      <ProductView product={fullProduct as any} relatedItems={relatedItems} />
    </div>
  );
}
