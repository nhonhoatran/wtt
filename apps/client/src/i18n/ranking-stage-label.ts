import { format, type Dictionary } from './get-dictionary';
import { roundLabel } from './render-bracket-labels';

/** Known engine stage codes are translated; custom configured stage codes remain readable. */
export function rankingStageLabel(t: Dictionary, code: string): string {
  if (code === 'W') return t.rankings.stages.winner;
  if (code === 'GROUP') return t.rankings.stages.group;
  const groupPlace = /^GROUP-(\d+)$/.exec(code);
  if (groupPlace) return format(t.rankings.stages.groupPlace, { n: groupPlace[1]! });
  const qualifying = /^QF-(\d+)$/.exec(code);
  return roundLabel(t.bracket, code, qualifying ? Number(qualifying[1]) : 1);
}
