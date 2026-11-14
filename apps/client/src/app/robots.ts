import type { MetadataRoute } from 'next';
import { serverEnv } from '../lib/server-env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = serverEnv.publicSiteUrl().replace(/\/+$/, '');
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' }, sitemap: `${base}/sitemap.xml` };
}
