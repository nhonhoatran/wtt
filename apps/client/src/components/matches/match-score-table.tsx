import type { PublicMatchDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { ScrollRegion } from '../common/scroll-region';
import { SidePlayers } from '../players/side-players';
import styles from './match-score-table.module.css';

export function MatchScoreTable({ match, locale, t }: { match: PublicMatchDetail; locale: Locale; t: Dictionary['match'] }) {
  const rows = [
    { side: match.side1, games: match.games1, score: (g: { score1: number }) => g.score1, won: match.winnerSide === 1 },
    { side: match.side2, games: match.games2, score: (g: { score2: number }) => g.score2, won: match.winnerSide === 2 },
  ];
  return (
    <ScrollRegion label={t.scoreTable}>
      <table className={styles.table}>
        <caption className="visually-hidden">{t.scoreTable}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.nameCol}>
              <span className="visually-hidden">{t.sideColumn}</span>
            </th>
            {match.games.map((g) => (
              <th key={g.number} scope="col">
                {format(t.game, { n: g.number })}
              </th>
            ))}
            <th scope="col">{t.games}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.won ? styles.winner : undefined}>
              <th scope="row" className={styles.nameCol}>
                {row.side ? <SidePlayers side={row.side} locale={locale} /> : format(t.side, { n: i + 1 })}
              </th>
              {match.games.map((g) => (
                <td key={g.number}>{row.score(g)}</td>
              ))}
              <td className={styles.total}>{row.games ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
