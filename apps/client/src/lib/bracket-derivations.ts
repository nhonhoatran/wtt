import type { PublicBracketMatch, PublicBracketRound, PublicSide, PublicSideSource } from '@kamito/shared';

export interface NextMatch {
  matchNo: number;
  round: PublicBracketRound;
  orderInRound: number;
}

/** Calendar day (YYYY-MM-DD) of an instant in the event time zone. */
export function localDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** Earliest scheduled day of a round, or null while none of its matches has a time. */
export function roundDay(round: PublicBracketRound, timeZone: string): string | null {
  let first: string | null = null;
  for (const match of round.matches) {
    if (!match.scheduledAt) continue;
    const day = localDay(match.scheduledAt, timeZone);
    if (first === null || day < first) first = day;
  }
  return first;
}

/**
 * Maps each match to the later match its winner plays in. WINNER_OF sources are exact; once a side is filled in
 * the source is gone, so in a regular halving draw the match at position i feeds position i/2 of the next round.
 */
export function nextMatchByNo(rounds: PublicBracketRound[]): Map<number, NextMatch> {
  const next = new Map<number, NextMatch>();
  for (const round of rounds) {
    for (const match of round.matches) {
      for (const source of [match.side1Source, match.side2Source]) {
        if (source?.type === 'WINNER_OF') next.set(source.matchNo, { matchNo: match.matchNo, round, orderInRound: match.orderInRound });
      }
    }
  }
  rounds.forEach((round, r) => {
    const following = rounds[r + 1];
    if (!following || following.matches.length * 2 !== round.matches.length) return;
    round.matches.forEach((match, i) => {
      const target = following.matches[Math.floor(i / 2)]!;
      if (!next.has(match.matchNo)) next.set(match.matchNo, { matchNo: target.matchNo, round: following, orderInRound: target.orderInRound });
    });
  });
  return next;
}

export interface LocatedMatch {
  round: PublicBracketRound;
  roundIndex: number;
  index: number;
  match: PublicBracketMatch;
}

export function locateMatch(rounds: PublicBracketRound[], matchNo: number): LocatedMatch | null {
  for (const [roundIndex, round] of rounds.entries()) {
    const index = round.matches.findIndex((match) => match.matchNo === matchNo);
    if (index >= 0) return { round, roundIndex, index, match: round.matches[index]! };
  }
  return null;
}

/** The earlier match that fills one side: exact through WINNER_OF, else by position in a regular halving draw. */
function feederOf(rounds: PublicBracketRound[], at: LocatedMatch, sideIndex: 0 | 1): LocatedMatch | null {
  const source = sideIndex === 0 ? at.match.side1Source : at.match.side2Source;
  if (source?.type === 'WINNER_OF') return locateMatch(rounds, source.matchNo);
  const previous = rounds[at.roundIndex - 1];
  const index = at.index * 2 + sideIndex;
  if (!previous || previous.matches.length !== at.round.matches.length * 2 || !previous.matches[index]) return null;
  return { round: previous, roundIndex: at.roundIndex - 1, index, match: previous.matches[index]! };
}

export type PathStep =
  | { kind: 'win'; round: PublicBracketRound; match: PublicBracketMatch; opponent: PublicSide; wonGames: number; lostGames: number }
  | { kind: 'source'; source: PublicSideSource };

function sidePath(rounds: PublicBracketRound[], start: LocatedMatch, sideIndex: 0 | 1): PathStep[] {
  const steps: PathStep[] = [];
  let at = start;
  let side = sideIndex;
  for (let guard = rounds.length; guard > 0; guard--) {
    const feeder = feederOf(rounds, at, side);
    if (!feeder) {
      const source = side === 0 ? at.match.side1Source : at.match.side2Source;
      if (source && source.type !== 'WINNER_OF') steps.unshift({ kind: 'source', source });
      break;
    }
    const { match } = feeder;
    if (match.status !== 'OFFICIAL' || match.winnerSide === null) break;
    const won = match.winnerSide;
    const opponent = won === 1 ? match.side2 : match.side1;
    if (match.resultType !== 'BYE' && opponent) {
      const [wonGames, lostGames] = won === 1 ? [match.games1 ?? 0, match.games2 ?? 0] : [match.games2 ?? 0, match.games1 ?? 0];
      steps.unshift({ kind: 'win', round: feeder.round, match, opponent, wonGames, lostGames });
    }
    at = feeder;
    side = won === 1 ? 0 : 1;
  }
  return steps;
}

/** How each side reached a knockout match, earliest step first; stops at the first unplayed or unknown link. */
export function pathToMatch(rounds: PublicBracketRound[], matchNo: number): [PathStep[], PathStep[]] {
  const at = locateMatch(rounds, matchNo);
  return at ? [sidePath(rounds, at, 0), sidePath(rounds, at, 1)] : [[], []];
}

export interface FollowUp {
  next: LocatedMatch;
  /** Null until the other side of the next match is known. */
  opponent: PublicSide | null;
}

/** The match the winner plays next and who waits there. */
export function followUpMatch(rounds: PublicBracketRound[], matchNo: number): FollowUp | null {
  const at = locateMatch(rounds, matchNo);
  const target = nextMatchByNo(rounds).get(matchNo);
  const next = at && target ? locateMatch(rounds, target.matchNo) : null;
  if (!at || !next) return null;
  const marked = [next.match.side1Source, next.match.side2Source].findIndex((s) => s?.type === 'WINNER_OF' && s.matchNo === matchNo);
  const own = marked >= 0 ? marked : at.index % 2;
  return { next, opponent: own === 0 ? next.match.side2 : next.match.side1 };
}

const isSettled = (match: PublicBracketMatch) => match.resultType === 'BYE' || match.status === 'OFFICIAL';

/** First round that still has an unplayed match; the last round once everything is done. */
export function defaultRound(rounds: PublicBracketRound[]): number | null {
  const open = rounds.find((round) => round.matches.some((match) => !isSettled(match)));
  return (open ?? rounds.at(-1))?.number ?? null;
}

/** The requested round when the section has it, else the default round. */
export function pickRound(requested: number | null, rounds: PublicBracketRound[]): number | null {
  return requested !== null && rounds.some((round) => round.number === requested) ? requested : defaultRound(rounds);
}

/** Query value to round number; anything that is not a plain positive integer is ignored. */
export function parseRoundParam(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,3}$/.test(raw)) return null;
  return Number(raw);
}

/** Query key of a section's chosen round: plain `round` for one section, `round<section>` when several share the page. */
export const roundParamKey = (section: number, many: boolean): string => (many ? `round${section}` : 'round');

/** Matches that are really played (BYE excluded) and how many already have a result. */
export function roundProgress(round: PublicBracketRound): { total: number; done: number } {
  const played = round.matches.filter((match) => match.resultType !== 'BYE');
  return { total: played.length, done: played.filter((match) => match.status === 'OFFICIAL').length };
}

/** The final when the last round holds exactly one match; qualifying rounds with several deciders have none. */
export function finalMatch(rounds: PublicBracketRound[]): PublicBracketMatch | null {
  const last = rounds.at(-1);
  return last?.matches.length === 1 ? last.matches[0]! : null;
}

export function championSide(final: PublicBracketMatch) {
  if (final.status !== 'OFFICIAL' || final.winnerSide === null) return null;
  return final.winnerSide === 1 ? final.side1 : final.side2;
}
