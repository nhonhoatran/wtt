import Link from 'next/link';
import type { PublicEventDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalizedOrNull } from '../../i18n/pick-localized';
import { dayRelation, type DayRelation } from '../../lib/event-day-progress';
import { formatDay } from '../../lib/format-date-time';
import styles from './event-sidebar.module.css';

/** Days with public matches, each marked done / today / tomorrow and linking to that day's matches. */
export function EventDaysSchedule({ event, today, locale, t }: { event: PublicEventDetail; today: string; locale: Locale; t: Dictionary }) {
  if (event.days.length === 0) return null;
  const d = t.event.days;
  const mark: Record<DayRelation, string | null> = { past: d.done, today: d.today, tomorrow: d.tomorrow, later: null };
  return (
    <section className={styles.card} aria-labelledby="event-days">
      <h2 id="event-days" className={styles.title}>{d.title}</h2>
      <ol className={styles.days}>
        {event.days.map((day) => {
          const relation = dayRelation(day.date, today);
          const label = mark[relation];
          const sessions = day.sessions.map((s) => pickLocalizedOrNull(locale, s.name, s.nameEn)).filter(Boolean).join(' · ');
          return (
            <li key={day.date} className={`${styles.day} ${styles[relation]}`}>
              <div className={styles.dayHead}>
                <Link href={`/${locale}/events/${event.slug}/matches?date=${day.date}`} className={styles.dayLink}>
                  {formatDay(day.date, locale)}
                </Link>
                {label && <span className={styles.dayMark}>{label}</span>}
              </div>
              {sessions && <p className={styles.sessions}>{sessions}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
