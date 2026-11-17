import Link from 'next/link';
import type { PublicPlayerListItem, PublicPlayerRank } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { ScrollRegion } from '../common/scroll-region';
import tableStyles from '../rankings/rankings.module.css';
import { PlayerIdentity } from './player-identity';
import styles from './players.module.css';

function Ranks({ ranks, locale, t }: { ranks: PublicPlayerRank[]; locale: Locale; t: Dictionary['players'] }) {
  if (ranks.length === 0) return <span className={styles.muted}>{t.noRank}</span>;
  return <ul className={styles.rankList}>{ranks.map(({ list, rank }) => <li key={list.code}>
    <Link href={`/${locale}/rankings/${list.code}`} title={pickLocalized(locale, list.name, list.nameEn)}>
      <strong>#{rank}</strong> <span>{pickLocalized(locale, list.name, list.nameEn)}</span>
    </Link>
  </li>)}</ul>;
}

export function PlayerTable({ items, locale, t }: { items: PublicPlayerListItem[]; locale: Locale; t: Dictionary['players'] }) {
  return (
    <ScrollRegion label={t.title}>
      <table className={tableStyles.table}>
        <caption className="visually-hidden">{t.title}</caption>
        <thead><tr>
          <th scope="col" className={tableStyles.playerCol}>{t.name}</th>
          <th scope="col">{t.club}</th>
          <th scope="col">{t.gender}</th>
          <th scope="col">{t.singlesRank}</th>
          <th scope="col">{t.doublesRank}</th>
        </tr></thead>
        <tbody>{items.map((player) => <tr key={player.slug}>
          <th scope="row" className={tableStyles.playerCol}><PlayerIdentity player={player} locale={locale} showClub={false} /></th>
          <td>{player.club ?? '–'}</td>
          <td>{t.genders[player.gender]}</td>
          <td><Ranks ranks={player.ranks.filter((rank) => rank.list.competitorKind === 'SINGLES')} locale={locale} t={t} /></td>
          <td><Ranks ranks={player.ranks.filter((rank) => rank.list.competitorKind === 'DOUBLES')} locale={locale} t={t} /></td>
        </tr>)}</tbody>
      </table>
    </ScrollRegion>
  );
}
