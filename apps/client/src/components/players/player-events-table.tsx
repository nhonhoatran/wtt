import Link from 'next/link';
import type { PublicPlayerEvent } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import { EmptyState } from '../common/empty-state';
import styles from './player-results.module.css';

export function PlayerEventsTable({ events, locale, t }: { events: PublicPlayerEvent[]; locale: Locale; t: Dictionary['players']['profile'] }) {
  if (events.length === 0) return <EmptyState text={t.noEvents} />;
  return (
    <div className={styles.eventsView}>
      <table className={styles.table}>
        <caption className="visually-hidden">{t.eventsTable.caption}</caption>
        <thead>
          <tr><th scope="col">{t.eventsTable.event}</th><th scope="col">{t.eventsTable.dates}</th></tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.slug}>
              <th scope="row" className={styles.eventName}><Link className={styles.eventLink} href={`/${locale}/events/${event.slug}`}>{pickLocalized(locale, event.name, event.nameEn)}</Link></th>
              <td className={styles.date}>{formatDateRange(event.startDate, event.endDate, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
