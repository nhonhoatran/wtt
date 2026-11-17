import type { PublicRankingRow } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { ScrollRegion } from '../common/scroll-region';
import { PlayerIdentity } from '../players/player-identity';
import { PointsBreakdownDetails } from './points-breakdown-details';
import { RankMovement } from './rank-movement';
import styles from './rankings.module.css';

export function RankingTable({ items, caption, locale, t, compact = false }: { items: PublicRankingRow[]; caption: string; locale: Locale; t: Dictionary; compact?: boolean }) {
  return (
    <ScrollRegion label={caption}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr>
          <th scope="col">{t.rankings.rank}</th>
          <th scope="col" className={styles.playerCol}>{t.rankings.player}</th>
          <th scope="col">{t.rankings.points}</th>
          {!compact && <th scope="col" className={styles.secondaryCol}>{t.rankings.resultCount}</th>}
        </tr></thead>
        <tbody>{items.map((row, i) => (
          <tr key={row.rank + ':' + i}>
            <td className={styles.rankCell}><strong>{row.rank}</strong><RankMovement movement={row.movement} t={t.rankings} /></td>
            <th scope="row" className={styles.playerCol}><PlayerIdentity player={row.player} locale={locale} /></th>
            <td className={styles.pointsCell}>
              <strong>{row.points.toLocaleString(locale)}</strong>
              {!compact && <PointsBreakdownDetails items={row.breakdown} locale={locale} t={t} />}
            </td>
            {!compact && <td className={styles.secondaryCol}>{row.resultsCounted}</td>}
          </tr>
        ))}</tbody>
      </table>
    </ScrollRegion>
  );
}
