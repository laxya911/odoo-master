import type { Metadata } from 'next';
import { getRestaurantProducts, getRestaurantProductDetails } from '@/lib/odoo-products';
import { ProductView } from '@/components/menu/ProductView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { generateSlug } from '@/lib/utils';
import type { Product } from '@/lib/types';

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

async function getProductDetails(id: number) {
  try {
    return await getRestaurantProductDetails(id);
  } catch (e) {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const data = await getRestaurantProducts({ limit: 1000 });
    return (data.data || []).map((p: Product) => ({
      slug: generateSlug(p.name),
    }));
  } catch (e) {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const productsData = await getProducts();

  if ('error' in productsData) {
    return { title: 'Product Not Found | RAM Dining' };
  }

  const products = productsData.data as Product[];
  const product = products.find(p => generateSlug(p.name) === slug);

  if (!product) return { title: 'Product Not Found | RAM Dining' };

  return {
    title: `${product.name} | RAM Dining`,
    description: typeof product.description_sale === 'string' ? product.description_sale : `Order ${product.name} from RAM Dining.`,
    openGraph: {
      title: product.name,
      description: typeof product.description_sale === 'string' ? product.description_sale : '',
      images: product.image_256 ? [{ url: `data:image/png;base64,${product.image_256}` }] : [],
    }
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const productsData = await getProducts();

  if ('error' in productsData) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
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
          <h1 className="text-4xl font-bold mb-4">Product Not Found</h1>
          <p className="text-neutral-400">The product you are looking for does not exist.</p>
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
