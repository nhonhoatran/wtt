import type { PublicEventDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { eventDayCount } from '../../lib/event-day-progress';
import { formatDateRange } from '../../lib/format-date-time';
import { MapLink } from './event-hero-parts';
import styles from './event-sidebar.module.css';

/** Dates, venue with address and map, and tier: only the facts the event actually has. */
export function EventQuickInfo({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  const q = t.event.quickInfo;
  const days = eventDayCount(event.startDate, event.endDate);
  const venueName = event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null;
  const where = [venueName, event.venue?.address ?? event.city].filter(Boolean).join(', ');
  return (
    <section className={styles.card} aria-labelledby="event-quick-info">
      <h2 id="event-quick-info" className={styles.title}>{q.title}</h2>
      <dl className={styles.facts}>
        <div>
          <dt>{q.dates}</dt>
          <dd>{formatDateRange(event.startDate, event.endDate, locale)}{days > 1 && ` (${format(q.days, { n: days })})`}</dd>
        </div>
        {where && (
          <div>
            <dt>{q.venue}</dt>
            <dd>
              {where}
              {event.venue?.mapUrl && <MapLink url={event.venue.mapUrl} label={t.event.hero.map} t={t} className={styles.mapLink} />}
            </dd>
          </div>
        )}
        <div>
          <dt>{q.tier}</dt>
          <dd className={styles.tier}>{pickLocalized(locale, event.tier.name, event.tier.nameEn)}</dd>
        </div>
      </dl>
    </section>
  );
}
