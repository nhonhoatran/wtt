import { isPlayedMatch, isRealMatch } from '@kamito/shared';
import type { EngineGroupStanding, EngineMatch, StageOptions, StageReached } from './types.js';

const FINAL_CODE = 'F';
const WINNER_CODE = 'W';

function involves(match: EngineMatch, entryId: string): boolean {
  return match.side1EntryId === entryId || match.side2EntryId === entryId;
}

function sideOf(match: EngineMatch, entryId: string): number {
  return match.side1EntryId === entryId ? 1 : 2;
}

function lastOfficial(matches: EngineMatch[], entryId: string): EngineMatch | null {
  let last: EngineMatch | null = null;
  for (const match of matches) {
    if (!involves(match, entryId) || match.status !== 'OFFICIAL' || match.isVoided) continue;
    if (!last || match.roundNumber > last.roundNumber) last = match;
  }
  return last;
}

/** A BYE advance is not a played match, so only a real loss or a won final decides the stage. */
function knockoutStage(matches: EngineMatch[], entryId: string, drawKind: 'MAIN' | 'QUALIFYING'): string | null {
  const last = lastOfficial(matches, entryId);
  if (!last || !isRealMatch(last)) return null;
  const won = last.winnerSide === sideOf(last, entryId);
  if (won) return drawKind === 'MAIN' && last.roundCode === FINAL_CODE ? WINNER_CODE : null;
  return last.roundCode;
}

function groupStage(standing: EngineGroupStanding | null, options: StageOptions): string | null {
  if (!standing || !standing.complete || standing.qualified) return null;
  return options.groupStageByRank && standing.rank !== null ? `GROUP-${standing.rank}` : 'GROUP';
}

/** A walkover loss in the entry's only real match is a no-show, not a result worth points unless configured. */
function isNoShow(matches: EngineMatch[], entryId: string, drawKind: StageReached['drawKind']): boolean {
  if (drawKind === 'GROUP') return false;
  const played = matches.filter((m) => involves(m, entryId) && isPlayedMatch(m));
  const only = played.length === 1 ? played[0] : undefined;
  return only?.resultType === 'WALKOVER' && only.winnerSide !== sideOf(only, entryId);
}

/** Null means the final position is not decided yet (or earns nothing). MAIN beats QUALIFYING beats GROUP. */
export function stageReached(
  entryId: string,
  matches: EngineMatch[],
  standing: EngineGroupStanding | null,
  options: StageOptions,
): StageReached | null {
  const inDraw = (kind: StageReached['drawKind']) => matches.filter((m) => m.drawKind === kind && involves(m, entryId));
  let result: StageReached | null = null;

  if (inDraw('MAIN').length > 0) {
    const code = knockoutStage(inDraw('MAIN'), entryId, 'MAIN');
    result = code ? { drawKind: 'MAIN', stageCode: code } : null;
  } else if (inDraw('QUALIFYING').length > 0) {
    const code = knockoutStage(inDraw('QUALIFYING'), entryId, 'QUALIFYING');
    result = code ? { drawKind: 'QUALIFYING', stageCode: code } : null;
  } else {
    const code = groupStage(standing, options);
    result = code ? { drawKind: 'GROUP', stageCode: code } : null;
  }

  if (result && !options.awardPointsOnWalkoverLoss && isNoShow(matches, entryId, result.drawKind)) return null;
  return result;
}
