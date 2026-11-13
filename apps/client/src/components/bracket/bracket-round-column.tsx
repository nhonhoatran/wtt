import type { PublicBracketRound } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import { BracketMatchCell } from './bracket-match-cell';
import styles from './bracket.module.css';

interface ColumnProps {
  round: PublicBracketRound;
  locale: Locale;
  t: Dictionary['bracket'];
  timeZone: string;
}

export function BracketRoundColumn({ round, locale, t, timeZone }: ColumnProps) {
  const pairs = [];
  for (let i = 0; i < round.matches.length; i += 2) pairs.push(round.matches.slice(i, i + 2));
  return (
    <li className={styles.round}>
      <h3 className={styles.roundTitle}>{roundLabel(t, round.code, round.number)}</h3>
      <div className={styles.roundBody}>
        {pairs.map((pair) => (
          <div key={pair[0]!.matchNo} className={styles.pair}>
            {pair.map((match) => (
              <BracketMatchCell key={match.matchNo} match={match} locale={locale} t={t} timeZone={timeZone} />
            ))}
          </div>
        ))}
      </div>
    </li>
  );
}
