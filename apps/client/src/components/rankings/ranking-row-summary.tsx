import type { PublicRankingRow } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { InitialsAvatar } from '../common/initials-avatar';
import { RankMovement } from './rank-movement';
import styles from './ranking-accordion.module.css';

/** Summary content only: no link here, because a link inside a disclosure button is a nested interactive control. */
export function RankingRowSummary({ row, name, locale, t }: { row: PublicRankingRow; name: string; locale: Locale; t: Dictionary }) {
  const r = t.rankings;
  return (
    <summary className={styles.summary}>
      <span className={styles.rank}>
        <span className="visually-hidden">{r.rank} </span>
        <strong>{row.rank}</strong>
      </span>
      <span className={styles.change}><RankMovement movement={row.movement} previousRank={row.previousRank} t={r} /></span>
      <span className={styles.player}>
        <InitialsAvatar name={name} photoUrl={row.player.photo?.url} size={36} className={styles.avatar} />
        <span className={styles.playerText}>
          <span className={styles.name}>{name}</span>
          {row.player.club && <span className={styles.clubInline}>{row.player.club}</span>}
        </span>
      </span>
      <span className={styles.club}>{row.player.club}</span>
      <span className={styles.count}><span className="visually-hidden">{r.tournaments} </span>{row.resultsCounted}</span>
      <span className={styles.points}><span className="visually-hidden">{r.points} </span>{row.points.toLocaleString(locale)}</span>
      <span className={styles.chevron} aria-hidden="true" />
      <span className="visually-hidden">{r.breakdown}</span>
    </summary>
  );
}
