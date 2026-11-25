import type { PublicSiteDisplay, SiteNavKey } from '@kamito/shared';
import type { Dictionary } from '../i18n/get-dictionary';
import type { Locale } from '../i18n/locales';

export interface NavItem {
  key: SiteNavKey;
  href: string;
  label: string;
}

export type NavCurrent = 'page' | 'location' | undefined;

/** Route structure per menu key (not a business value): path under /{locale}, and what a match means. */
const ROUTES: Record<SiteNavKey, { path: string; exact: 'page' | 'location'; section?: 'location'; skipExact?: string }> = {
  events: { path: 'events', exact: 'page', section: 'location', skipExact: 'events/calendar' },
  calendar: { path: 'events/calendar', exact: 'page' },
  rankings: { path: 'rankings', exact: 'page', section: 'location' },
  players: { path: 'players', exact: 'page', section: 'location' },
  news: { path: 'news', exact: 'location', section: 'location' },
  videos: { path: 'videos', exact: 'location', section: 'location' },
  contact: { path: 'contact', exact: 'page' },
};

export function resolveNavItems(items: PublicSiteDisplay['navItems'], locale: Locale, t: Dictionary['nav']): NavItem[] {
  return items.map((item) => {
    const override = (locale === 'en' ? item.labelEn : item.labelVi)?.trim();
    return { key: item.key, href: `/${locale}/${ROUTES[item.key].path}`, label: override || t[item.key] };
  });
}

export function navCurrent(key: SiteNavKey, pathname: string | null, locale: Locale): NavCurrent {
  if (!pathname) return undefined;
  const route = ROUTES[key];
  const base = `/${locale}/${route.path}`;
  if (pathname === base) return route.exact;
  if (!route.section || !pathname.startsWith(`${base}/`)) return undefined;
  if (route.skipExact && pathname === `/${locale}/${route.skipExact}`) return undefined;
  return route.section;
}
