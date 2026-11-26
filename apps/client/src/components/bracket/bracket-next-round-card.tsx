import Link from 'next/link';
import type { PublicBracketRound } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import { roundDay } from '../../lib/bracket-derivations';
import { formatShortDay } from '../../lib/format-date-time';
import styles from './bracket-nav.module.css';

interface CardProps {
  rounds: PublicBracketRound[];
  selected: number | null;
  hrefFor: (round: number) => string;
  locale: Locale;
  t: Dictionary['bracket'];
  timeZone: string;
}

/** Narrow screens only: link to the round after the chosen one, with its first scheduled day when known. */
export function BracketNextRoundCard({ rounds, selected, hrefFor, locale, t, timeZone }: CardProps) {
  const next = rounds[rounds.findIndex((round) => round.number === selected) + 1];
  if (selected === null || !next) return null;
  const day = roundDay(next, timeZone);
  const name = roundLabel(t, next.code, next.number);
  const label = day ? format(t.roundWithDate, { round: name, date: formatShortDay(day, locale) }) : name;
  return (
    <Link href={hrefFor(next.number)} scroll={false} className={styles.nextCard}>
      {format(t.nextRound, { round: label })}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
