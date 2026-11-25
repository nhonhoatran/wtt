import { format, type Dictionary } from '../../i18n/get-dictionary';

export interface SummaryInput {
  t: Dictionary['match'];
  winner: string;
  wonGames: number;
  lostGames: number;
  /** Label of a non-normal result (walk-over, retirement...); replaces the score. */
  result: string | null;
  /** The round the winner moves to and who waits there, when the draw says so. */
  next: { round: string; opponent: string | null } | null;
}

export function matchSummarySentence({ t, winner, wonGames, lostGames, result, next }: SummaryInput): string {
  if (result) return format(t.summary.wonResult, { winner, result });
  const values = { winner, a: wonGames, b: lostGames, round: next?.round ?? '', opponent: next?.opponent ?? '' };
  if (!next) return format(t.summary.won, values);
  return format(next.opponent ? t.summary.wonIntoVs : t.summary.wonInto, values);
}
