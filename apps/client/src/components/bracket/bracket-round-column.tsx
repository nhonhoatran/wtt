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
  /** One level below the heading that holds the bracket. */
  heading: 'h3' | 'h4';
}

export function BracketRoundColumn({ round, locale, t, timeZone, heading: Heading }: ColumnProps) {
  const pairs = [];
  for (let i = 0; i < round.matches.length; i += 2) pairs.push(round.matches.slice(i, i + 2));
  return (
    <li className={styles.round}>
      <Heading className={styles.roundTitle}>{roundLabel(t, round.code, round.number)}</Heading>
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
