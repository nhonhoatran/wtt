import type { Metadata } from 'next';
import type { PublicEventDetail, PublicImage } from '@kamito/shared';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../i18n/pick-localized';

const OG_LOCALES: Record<Locale, string> = { vi: 'vi_VN', en: 'en_US' };

interface PageMeta {
  /** Omitted on the home page, which takes the site name from the layout. */
  title?: string;
  description?: string | null;
  image?: PublicImage | null;
}

/**
 * Canonical, hreflang alternates and Open Graph for one page. `path` is the part after the locale,
 * with only the query values that pick different content (filters and paging stay out of the canonical).
 */
export function pageMetadata(locale: Locale, path: string, { title, description, image }: PageMeta): Metadata {
  const url = (l: Locale) => `/${l}${path}`;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: {
      canonical: url(locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, url(l)])), 'x-default': url(DEFAULT_LOCALE) },
    },
    openGraph: {
      type: 'website',
      url: url(locale),
      locale: OG_LOCALES[locale],
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: image.url, width: image.width, height: image.height, alt: pickLocalized(locale, image.alt ?? '', image.altEn) || undefined }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

/** Every event tab shares the event's summary and banner; `title` is the tab's own heading. */
export function eventPageMetadata(locale: Locale, event: PublicEventDetail, tabPath: string, title?: string): Metadata {
  const name = pickLocalized(locale, event.name, event.nameEn);
  return pageMetadata(locale, `/events/${event.slug}${tabPath}`, {
    title: title ? `${title} · ${name}` : name,
    description: pickLocalizedOrNull(locale, event.summary, event.summaryEn),
    image: event.banner,
  });
}
