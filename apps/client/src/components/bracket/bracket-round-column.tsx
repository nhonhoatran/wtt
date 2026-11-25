import type { PublicBracketRound } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import { roundDay, type NextMatch } from '../../lib/bracket-derivations';
import { formatShortDay } from '../../lib/format-date-time';
import { BracketMatchCell } from './bracket-match-cell';
import styles from './bracket.module.css';

interface ColumnProps {
  round: PublicBracketRound;
  locale: Locale;
  t: Dictionary['bracket'];
  timeZone: string;
  eventSlug: string;
  nextByNo: Map<number, NextMatch>;
  /** Shown alone on narrow screens; the other columns are hidden there. */
  selected: boolean;
  /** One level below the heading that holds the bracket. */
  heading: 'h3' | 'h4' | 'p';
}

export function BracketRoundColumn({ round, locale, t, timeZone, eventSlug, nextByNo, selected, heading: Heading }: ColumnProps) {
  const pairs = [];
  for (let i = 0; i < round.matches.length; i += 2) pairs.push(round.matches.slice(i, i + 2));
  const day = roundDay(round, timeZone);
  const name = roundLabel(t, round.code, round.number);
  return (
    <li className={styles.round} data-selected={selected ? '' : undefined}>
      <Heading className={styles.roundTitle}>{day ? format(t.roundWithDate, { round: name, date: formatShortDay(day, locale) }) : name}</Heading>
      <div className={styles.roundBody}>
        {pairs.map((pair) => (
          <div key={pair[0]!.matchNo} className={styles.pair}>
            {pair.map((match) => (
              <BracketMatchCell key={match.matchNo} match={match} locale={locale} t={t} timeZone={timeZone} eventSlug={eventSlug} next={nextByNo.get(match.matchNo) ?? null} day={day} />
            ))}
          </div>
        ))}
      </div>
    </li>
  );
}
