import Link from 'next/link';
import type { PublicEventCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import { StatusPill } from '../common/status-pill';
import { SubEventChips } from './sub-event-chips';
import { TierBadge } from './tier-badge';
import styles from './event-card.module.css';

const PILL = { ONGOING: 'ongoing', UPCOMING: 'upcoming', COMPLETED: 'completed' } as const;

/** Banner-less card of the home page: dates, tier, status, content chips and a details cue. The events list uses EventListRow. */
export function EventCard({ event, locale, t }: { event: PublicEventCard; locale: Locale; t: Dictionary }) {
  const name = pickLocalized(locale, event.name, event.nameEn);
  const place = [event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null, event.city].filter(Boolean).join(', ');
  return (
    <article className={styles.card}>
      <Link href={`/${locale}/events/${event.slug}`} className={styles.link}>
        <div className={styles.body}>
          <div className={styles.meta}>
            <TierBadge tier={event.tier} locale={locale} filled />
            <StatusPill variant={PILL[event.lifecycle]} label={t.events.status[event.lifecycle]} />
          </div>
          <p className={styles.when}>{formatDateRange(event.startDate, event.endDate, locale)}</p>
          <h3 className={styles.name}>{name}</h3>
          {place && <p className={styles.where}>{place}</p>}
          <SubEventChips subEvents={event.subEvents} locale={locale} />
        </div>
        <span className={styles.cue}>{t.home.cardDetails} <span aria-hidden="true">→</span></span>
      </Link>
    </article>
  );
}
