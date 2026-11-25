import type { PublicRankingRow } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { PointsBreakdownPanel } from './points-breakdown-panel';
import { RankingRowSummary } from './ranking-row-summary';
import styles from './ranking-accordion.module.css';

interface ListProps {
  items: PublicRankingRow[];
  label: string;
  locale: Locale;
  t: Dictionary;
  today: string;
  expiringSoonDays: number;
}

/** One native disclosure per row: opens without JavaScript and keeps the frozen breakdown in the HTML. */
export function RankingAccordionList({ items, label, locale, t, today, expiringSoonDays }: ListProps) {
  const r = t.rankings;
  return (
    <div className={styles.board}>
      <div className={styles.head} aria-hidden="true">
        <span>{r.rank}</span>
        <span>{r.change}</span>
        <span className={styles.headPlayer}>{r.player}</span>
        <span className={styles.headClub}>{r.club}</span>
        <span className={styles.headCount}>{r.tournaments}</span>
        <span>{r.points}</span>
        <span />
      </div>
      <ol className={styles.list} aria-label={label}>
        {items.map((row, i) => {
          const name = pickLocalized(locale, row.player.name, row.player.nameEn);
          return (
            <li key={`${row.rank}:${i}`} className={styles.item}>
              <details className={styles.row}>
                <RankingRowSummary row={row} name={name} locale={locale} t={t} />
                <PointsBreakdownPanel row={row} name={name} locale={locale} t={t} today={today} expiringSoonDays={expiringSoonDays} />
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
