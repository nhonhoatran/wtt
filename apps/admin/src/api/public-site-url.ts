let base = '';

/** Locale segment of the public site; the site redirects other locales to it. */
const PUBLIC_SITE_LOCALE = 'vi';

export function setPublicSiteUrl(value: string): void {
  base = value.trim().replace(/\/$/, '');
}

/** Public page of an event, or undefined when PUBLIC_SITE_URL is not configured. */
export function publicEventUrl(slug: string): string | undefined {
  return base ? `${base}/${PUBLIC_SITE_LOCALE}/events/${encodeURIComponent(slug)}` : undefined;
}
