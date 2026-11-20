import type { PublicEventDetail } from '@kamito/shared';
import type { Locale } from '../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../i18n/pick-localized';

export function sportsEventStructuredData(event: PublicEventDetail, locale: Locale, pageUrl: string): Record<string, unknown> {
  const venueName = event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null;
  const description = pickLocalizedOrNull(locale, event.summary, event.summaryEn);

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: pickLocalized(locale, event.name, event.nameEn),
    startDate: event.startDate,
    endDate: event.endDate,
    url: pageUrl,
    sport: 'Table tennis',
    ...(event.banner ? { image: [new URL(event.banner.url, pageUrl).toString()] } : {}),
    ...(description ? { description } : {}),
    ...(venueName || event.city ? {
      location: {
        '@type': 'Place',
        ...(venueName ? { name: venueName } : {}),
        ...(event.city ? { address: { '@type': 'PostalAddress', addressLocality: event.city } } : {}),
      },
    } : {}),
  };
}
