import type { PublicSideSource } from '@kamito/shared';
import { format, type Dictionary } from './get-dictionary';

type BracketDict = Dictionary['bracket'];

/** Labels a knockout round code (F, SF, QF, R16..) or a qualifying code (QF-1 is the decider). */
export function roundLabel(t: BracketDict, code: string, number: number): string {
  if (code === 'F' || code === 'SF' || code === 'QF') return t.rounds[code];
  const knockout = /^R(\d+)$/.exec(code);
  if (knockout) return format(t.rounds.R, { n: knockout[1]! });
  const qualifying = /^QF-(\d+)$/.exec(code);
  if (qualifying) return qualifying[1] === '1' ? t.rounds.QUAL_FINAL : format(t.rounds.QUAL, { n: number });
  return code;
}

export function sideSourceLabel(t: BracketDict, source: PublicSideSource | null): string {
  if (!source) return t.source.TBD;
  if (source.type === 'WINNER_OF') return format(t.source.WINNER_OF, { matchNo: source.matchNo });
  if (source.type === 'QUALIFIER') return format(t.source.QUALIFIER, { index: source.index });
  const key = source.place === 1 ? 'GROUP_PLACE_1' : source.place === 2 ? 'GROUP_PLACE_2' : 'GROUP_PLACE_N';
  return format(t.source[key], { group: source.group, place: source.place });
}
