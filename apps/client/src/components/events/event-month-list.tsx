import type { PublicEventCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { formatMonth } from '../../lib/format-date-time';
import { EventListRow } from './event-list-row';
import styles from './event-month-list.module.css';

/** Month headings with event rows under each; shared by the list page and the month calendar. */
export function EventMonthList({ groups, locale, t }: { groups: { month: string; items: PublicEventCard[] }[]; locale: Locale; t: Dictionary }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.month} aria-labelledby={`month-${group.month}`} className={styles.group}>
          <h2 id={`month-${group.month}`} className={styles.month}>{formatMonth(group.month, locale)}</h2>
          <ul className={styles.list}>
            {group.items.map((event) => (
              <li key={event.slug}>
                <EventListRow event={event} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
