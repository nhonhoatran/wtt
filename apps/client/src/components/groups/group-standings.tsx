import type { PublicGroup } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { ScrollRegion } from '../common/scroll-region';
import { sideClubs } from '../matches/side-name';
import { SidePlayers } from '../players/side-players';
import styles from './group-standings.module.css';

interface StandingsProps {
  group: PublicGroup;
  locale: Locale;
  t: Dictionary['groups'];
  headingId: string;
  /** "4 players" / "4 pairs"; omitted when the group is empty. */
  members: string | null;
}

/** One group as a card: navy head with the group name and size, then the standings table. */
export function GroupStandings({ group, locale, t, headingId, members }: StandingsProps) {
  const caption = format(t.standings, { code: group.code });
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 id={headingId} className={styles.title}>{format(t.group, { code: group.code })}</h3>
        {members && <span className={styles.members}>{members}</span>}
      </div>
      <ScrollRegion label={caption}>
        <table className={styles.table}>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{t.rank}</th>
              <th scope="col" className={styles.nameCol}>{t.player}</th>
              <th scope="col" className={styles.wide}>{t.club}</th>
              <th scope="col" className={styles.wide}>{t.played}</th>
              <th scope="col" className={styles.wide}>{t.won}</th>
              <th scope="col" className={styles.wide}>{t.lost}</th>
              <th scope="col" className={styles.narrow}>{t.wonLost}</th>
              <th scope="col">{t.gameDiff}</th>
              <th scope="col">{t.points}</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row, i) => {
              const clubs = sideClubs(row.side);
              return (
                <tr key={i} className={row.qualified ? styles.qualified : undefined}>
                  <td>
                    {row.rank ?? '–'}
                    {row.qualified && <span className="visually-hidden"> ({t.qualified})</span>}
                  </td>
                  <th scope="row" className={styles.nameCol}>
                    {row.side.seed != null && <span className={styles.seed}><span className="visually-hidden">{t.seed} </span>{row.side.seed}</span>}
                    <SidePlayers side={row.side} locale={locale} />
                    {clubs && <span className={`${styles.club} ${styles.narrowClub}`}>{clubs}</span>}
                  </th>
                  <td className={`${styles.club} ${styles.wide}`}>{clubs}</td>
                  <td className={styles.wide}>{row.played}</td>
                  <td className={styles.wide}>{row.won}</td>
                  <td className={styles.wide}>{row.lost}</td>
                  <td className={styles.narrow}>{row.won}–{row.lost}</td>
                  <td>{row.gamesFor}–{row.gamesAgainst}</td>
                  <td className={styles.points}>{row.matchPoints}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  );
}
