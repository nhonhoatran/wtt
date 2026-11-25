import type { PublicEventDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import { eventDayProgress } from '../../lib/event-day-progress';
import styles from './event-hero-stats.module.css';

/** Players, events and (while the event runs) the match day; a figure without data is left out. */
export function EventHeroStats({ event, today, t }: { event: PublicEventDetail; today: string; t: Dictionary }) {
  const h = t.event.hero;
  const progress = event.lifecycle === 'ONGOING' ? eventDayProgress(event.startDate, event.endDate, today) : null;
  const stats = [
    event.stats.players > 0 ? { label: h.players, value: String(event.stats.players) } : null,
    event.subEvents.length > 0 ? { label: h.contents, value: String(event.subEvents.length) } : null,
    progress ? { label: h.matchDay, value: format('{day}/{total}', progress), accent: true } : null,
  ].filter((s) => s !== null);
  if (stats.length === 0) return null;
  return (
    <dl className={styles.stats}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <dt className={styles.statLabel}>{s.label}</dt>
          <dd className={s.accent ? `${styles.statValue} ${styles.statAccent}` : styles.statValue}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
