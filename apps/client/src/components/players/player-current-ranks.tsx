import Link from 'next/link';
import type { PublicPlayerRank } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatFullDate } from '../../lib/format-date-time';
import { EmptyState } from '../common/empty-state';
import { RankMovement } from '../rankings/rank-movement';
import styles from './players.module.css';

export function PlayerCurrentRanks({ ranks, locale, t }: { ranks: PublicPlayerRank[]; locale: Locale; t: Dictionary }) {
  if (ranks.length === 0) return <EmptyState text={t.players.profile.noRanks} />;
  return (
    <ul className={styles.currentRanks}>{ranks.map((rank) => <li key={rank.list.code}>
      <Link className="text-link" href={`/${locale}/rankings/${rank.list.code}`}>{pickLocalized(locale, rank.list.name, rank.list.nameEn)}</Link>
      <div className={styles.rankValue}><strong>#{rank.rank}</strong><RankMovement movement={rank.movement} t={t.rankings} /></div>
      <p>{rank.points.toLocaleString(locale)} {t.rankings.points.toLowerCase()}</p>
      <p className={styles.muted}>{format(t.rankings.updated, { date: formatFullDate(rank.asOfDate, locale) })}</p>
    </li>)}</ul>
  );
}
