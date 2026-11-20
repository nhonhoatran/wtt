import { DEFAULT_LOCALE, LOCALES } from '../i18n/locales';
import { getRankings, getSitemap } from './public-data';
import { serverEnv } from './server-env';
import type { SitemapEntry } from './sitemap-xml';

export async function loadSitemapEntries(): Promise<SitemapEntry[]> {
  const base = serverEnv.publicSiteUrl().replace(/\/+$/, '');
  const entries = (path: string, lastModified?: string): SitemapEntry[] => LOCALES.map((locale) => ({
    url: `${base}/${locale}${path}`,
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])), 'x-default': `${base}/${DEFAULT_LOCALE}${path}` } },
  }));
  const [data, rankings] = await Promise.all([getSitemap(), getRankings()]);
  return [
    ...['', '/events', '/events/calendar', '/rankings', '/news', '/videos', '/contact'].flatMap((path) => entries(path)),
    ...(data?.events ?? []).flatMap((event) => {
      const path = `/events/${event.slug}`;
      const paths = [path];
      if (event.tabs?.info) paths.push(`${path}/info`);
      if (event.tabs?.matches) paths.push(`${path}/matches`);
      for (const subEvent of event.subEvents ?? []) {
        if (subEvent.drawKinds.includes('MAIN')) paths.push(`${path}/draws/${subEvent.code}`);
        if (subEvent.drawKinds.includes('QUALIFYING')) paths.push(`${path}/draws/${subEvent.code}?draw=qualifying`);
        if (subEvent.hasGroups) paths.push(`${path}/groups/${subEvent.code}`);
        if (subEvent.entryCount > 0) paths.push(`${path}/players/${subEvent.code}`);
      }
      return paths.flatMap((route) => entries(route, event.updatedAt));
    }),
    ...(data?.articles ?? []).flatMap((article) => entries(`/news/${article.slug}`, article.updatedAt)),
    ...(data?.pages ?? []).flatMap((page) => entries(`/pages/${page.slug}`, page.updatedAt)),
    ...(data?.videos ?? []).flatMap((video) => entries(`/videos/${video.slug}`, video.updatedAt)),
    ...(data?.matches ?? []).flatMap((match) => entries(`/events/${match.eventSlug}/matches/${match.matchNo}`, match.updatedAt)),
    ...(rankings?.items ?? []).flatMap((row) => entries(`/rankings/${row.list.code}`, row.publishedAt ?? undefined)),
  ];
}
