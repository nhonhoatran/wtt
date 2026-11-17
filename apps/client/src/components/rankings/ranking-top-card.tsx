import Link from 'next/link';
import type { PublicRankingTop } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatFullDate } from '../../lib/format-date-time';
import { EmptyState } from '../common/empty-state';
import { RankingTable } from './ranking-table';
import styles from './rankings.module.css';

export function RankingTopCard({ ranking, locale, t }: { ranking: PublicRankingTop; locale: Locale; t: Dictionary }) {
  const name = pickLocalized(locale, ranking.list.name, ranking.list.nameEn);
  return (
    <section className={styles.topCard}>
      <div className={styles.cardHead}>
        <h3><Link href={`/${locale}/rankings/${ranking.list.code}`}>{name}</Link></h3>
        <p className={styles.note}>{ranking.asOfDate ? format(t.rankings.updated, { date: formatFullDate(ranking.asOfDate, locale) }) : t.rankings.pending}</p>
      </div>
      {ranking.items.length ? <RankingTable items={ranking.items} caption={name} locale={locale} t={t} compact /> : <EmptyState text={t.rankings.pending} />}
      <Link className={styles.viewAll} href={`/${locale}/rankings/${ranking.list.code}`}>{t.rankings.viewAll}<span aria-hidden="true"> →</span></Link>
    </section>
  );
}
