import Link from 'next/link';
import type { PublicEventCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import { TierBadge } from './tier-badge';
import styles from './event-card.module.css';

/** One event in a list: banner, tier, name, dates and place; the whole card is one link. */
export function EventCard({ event, locale, t }: { event: PublicEventCard; locale: Locale; t: Dictionary }) {
  const name = pickLocalized(locale, event.name, event.nameEn);
  const place = [event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null, event.city].filter(Boolean).join(', ');
  return (
    <article className={styles.card}>
      <Link href={`/${locale}/events/${event.slug}`} className={styles.link}>
        <div className={styles.media}>
          {event.banner && (
            // Variants are pre-sized WebP from the media worker; next/image would re-encode them.
            <img
              src={event.banner.url}
              width={event.banner.width}
              height={event.banner.height}
              alt={pickLocalizedOrNull(locale, event.banner.alt, event.banner.altEn) ?? ''}
              loading="lazy"
            />
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.meta}>
            <TierBadge tier={event.tier} locale={locale} />
            <span className={styles.status}>{t.events.status[event.lifecycle]}</span>
          </div>
          <h3 className={styles.name}>{name}</h3>
          <p className={styles.when}>{formatDateRange(event.startDate, event.endDate, locale)}</p>
          {place && <p className={styles.where}>{place}</p>}
        </div>
      </Link>
    </article>
  );
}
