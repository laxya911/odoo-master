import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/checkout', '/profile'], // Keep private/API routes hidden from crawlers
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
