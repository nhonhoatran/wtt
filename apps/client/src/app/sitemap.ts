import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, LOCALES } from '../i18n/locales';
import { getSitemap } from '../lib/public-data';
import { serverEnv } from '../lib/server-env';

// Built per request: the Docker build cannot reach the API (Spike E).
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = serverEnv.publicSiteUrl().replace(/\/+$/, '');
  const entry = (path: string, lastModified?: string) => ({
    url: `${base}/${DEFAULT_LOCALE}${path}`,
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])), 'x-default': `${base}/${DEFAULT_LOCALE}${path}` } },
  });
  const data = await getSitemap();
  return [entry(''), entry('/events'), entry('/events/calendar'), ...(data?.events ?? []).map((e) => entry(`/events/${e.slug}`, e.updatedAt))];
}
