import Link from 'next/link';
import type { PublicEventCard } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatDateBlock } from '../../lib/format-date-block';
import { StatusPill } from '../common/status-pill';
import { SubEventChips } from './sub-event-chips';
import { TierBadge } from './tier-badge';
import styles from './event-list-row.module.css';

const PILL = { ONGOING: 'ongoing', UPCOMING: 'upcoming', COMPLETED: 'completed' } as const;

/** One event as a row for the list and the calendar. The name is the main link; the button repeats it with a status-specific label. */
export function EventListRow({ event, locale, t }: { event: PublicEventCard; locale: Locale; t: Dictionary }) {
  const base = `/${locale}/events/${event.slug}`;
  const name = pickLocalized(locale, event.name, event.nameEn);
  const place = [event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null, event.city].filter(Boolean).join(', ');
  const block = formatDateBlock(event.startDate, event.endDate, locale);
  const ongoing = event.lifecycle === 'ONGOING';
  const toMatches = ongoing && event.hasPublicMatches;
  const nameId = `event-row-${event.slug}`;
  return (
    <article className={styles.row}>
      <div className={styles.date}>
        <span className={styles.days}>{block.days}</span>
        <span className={styles.period}>{block.period}</span>
      </div>
      <div className={styles.main}>
        <div className={styles.kind}>
          <TierBadge tier={event.tier} locale={locale} filled />
          <span className={styles.type}>{pickLocalized(locale, event.eventType.name, event.eventType.nameEn)}</span>
        </div>
        <h3 id={nameId} className={styles.name}>
          <Link href={base} className={styles.nameLink}>{name}</Link>
        </h3>
        {place && <p className={styles.place}>{place}</p>}
        <div className={styles.foot}>
          <SubEventChips subEvents={event.subEvents} locale={locale} />
          {event.subEvents.length > 0 && <span className={styles.count}>{format(t.events.subEventCount, { n: event.subEvents.length })}</span>}
        </div>
      </div>
      <div className={styles.side}>
        <StatusPill variant={PILL[event.lifecycle]} label={t.events.status[event.lifecycle]} dot={ongoing} />
        <Link href={toMatches ? `${base}/matches` : base} className={ongoing ? `${styles.cta} ${styles.ctaMain}` : styles.cta} aria-describedby={nameId}>
          {toMatches ? t.events.scheduleCta : t.events.detailsCta}
        </Link>
      </div>
    </article>
  );
}
