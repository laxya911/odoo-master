import type { Metadata } from 'next';
import type { Product, Paginated, OdooRecord, OdooError } from '@/lib/types';
import { ProductView } from '@/components/menu/ProductView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { generateSlug } from '@/lib/utils';

async function getProducts(): Promise<Paginated<OdooRecord> | { error: OdooError }> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/restaurant/products`);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return { error: { message: 'Failed to fetch products', status: res.status } };
    return res.json();
  } catch (e) {
    return { error: { message: (e as Error).message, status: 500 } };
  }
}

async function getProductDetails(id: number): Promise<Partial<Product> | null> {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/restaurant/product-details?id=${id}`);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function generateStaticParams() {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/restaurant/products`);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
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
