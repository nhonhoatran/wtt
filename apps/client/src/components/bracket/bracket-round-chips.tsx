import Link from 'next/link';
import type { PublicBracketRound } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import { roundDay, roundProgress } from '../../lib/bracket-derivations';
import { formatShortDay } from '../../lib/format-date-time';
import styles from './bracket-nav.module.css';

interface ChipsProps {
  rounds: PublicBracketRound[];
  selected: number | null;
  hrefFor: (round: number) => string;
  locale: Locale;
  t: Dictionary['bracket'];
  timeZone: string;
  label: string;
}

/** Narrow screens only: one link per round (?round=N) plus a one-line summary of the chosen round. */
export function BracketRoundChips({ rounds, selected, hrefFor, locale, t, timeZone, label }: ChipsProps) {
  const index = rounds.findIndex((round) => round.number === selected);
  const current = rounds[index];
  const progress = current ? roundProgress(current) : null;
  return (
    <div className={styles.chips}>
      <nav aria-label={`${t.roundChips} · ${label}`}>
        <ul className={styles.chipList}>
          {rounds.map((round) => {
            const day = roundDay(round, timeZone);
            return (
              <li key={round.number}>
                <Link href={hrefFor(round.number)} scroll={false} className={styles.chip} aria-current={round.number === selected ? 'true' : undefined}>
                  <span>{roundLabel(t, round.code, round.number)}</span>
                  {day && <span className={styles.chipDate}>{formatShortDay(day, locale)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {current && progress && (
        <p className={styles.summary}>
          <span>{format(t.roundSummary, { n: index + 1, total: rounds.length, matches: progress.total })}</span>
          {progress.done > 0 && <strong>{format(t.roundDone, { n: progress.done })}</strong>}
        </p>
      )}
    </div>
  );
}
