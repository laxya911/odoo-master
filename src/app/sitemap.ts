import { MetadataRoute } from 'next';
export const dynamic = 'force-dynamic';
import { generateSlug } from '@/lib/utils';
import { odooCall } from '@/lib/odoo-client';
import type { Product } from '@/lib/types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Base static routes
  const routes = [
    '',
    '/menu',
    '/booking',
    '/team',
    '/gallery',
    '/auth',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic Menu Routes
  try {
    const products = await odooCall<Product[]>('product.template', 'search_read', {
      domain: [['available_in_pos', '=', true], ['name', 'not ilike', 'tip']],
      fields: ['id', 'name', 'write_date'],
      limit: 1000,
    });

    const productRoutes = products.map((product) => ({
      url: `${baseUrl}/menu/${generateSlug(product.name)}?id=${product.id}`,
      lastModified: new Date(product.write_date || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...routes, ...productRoutes];
  } catch (error) {
    console.error('Sitemap generation failed to fetch products:', error);
    return routes; // Graceful fallback
  }
}
