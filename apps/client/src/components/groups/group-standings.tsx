import type { PublicGroup } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { ScrollRegion } from '../common/scroll-region';
import tableStyles from '../matches/match-score-table.module.css';
import { sideClubs, sideName } from '../matches/side-name';
import styles from './group-standings.module.css';

export function GroupStandings({ group, locale, t }: { group: PublicGroup; locale: Locale; t: Dictionary['groups'] }) {
  const caption = format(t.standings, { code: group.code });
  return (
    <ScrollRegion label={caption}>
      <table className={tableStyles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.rank}</th>
            <th scope="col" className={tableStyles.nameCol}>{t.player}</th>
            <th scope="col">{t.wonLost}</th>
            <th scope="col">{t.gameDiff}</th>
            <th scope="col">{t.points}</th>
            <th scope="col">{t.qualified}</th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((row, i) => (
            <tr key={i} className={row.qualified ? styles.qualified : undefined}>
              <td>{row.rank ?? '–'}</td>
              <th scope="row" className={tableStyles.nameCol}>
                {row.side.seed != null && <span className={styles.club}>[{row.side.seed}] </span>}
                {sideName(locale, row.side)}
                {sideClubs(row.side) && <span className={styles.club}> · {sideClubs(row.side)}</span>}
              </th>
              <td>{row.won}–{row.lost}</td>
              <td>{row.gamesFor}–{row.gamesAgainst}</td>
              <td>{row.matchPoints}</td>
              <td>{row.qualified ? <abbr title={t.qualified}>{t.qualifiedMark}</abbr> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
