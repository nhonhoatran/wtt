import Link from 'next/link';
import type { PublicEventDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import styles from './event-hero.module.css';

export function HeroBackLink({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <Link href={`/${locale}/events`} className={styles.back}>
      <span aria-hidden="true">←</span> {t.event.backToEvents}
    </Link>
  );
}

/** Opens the venue map in a new tab; the API only serves https map links. */
export function MapLink({ url, label, t, className }: { url: string; label: string; t: Dictionary; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      <span className="visually-hidden"> ({t.nav.opensInNewTab})</span>
    </a>
  );
}

/** "venue, city" as one line; the venue name links to the map when the organiser gave one. */
export function EventPlace({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  const venueName = event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null;
  if (!venueName && !event.city) return null;
  const mapUrl = event.venue?.mapUrl;
  return (
    <span>
      {venueName && (mapUrl ? <MapLink url={mapUrl} label={venueName} t={t} className={styles.mapLink} /> : venueName)}
      {venueName && event.city && ', '}
      {event.city}
    </span>
  );
}

export function EventWhenWhere({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  return (
    <p className={styles.meta}>
      <span>{formatDateRange(event.startDate, event.endDate, locale)}</span>
      <EventPlace event={event} locale={locale} t={t} />
    </p>
  );
}
