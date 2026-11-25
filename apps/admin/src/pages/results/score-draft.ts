import { checkGame, gamesToWin, validateMatchScore, type GameScore, type MatchScoreOutcome, type ScoreFormat } from '@kamito/competition-engine';
import type { MatchDetail } from './match-types';

export interface GameDraft {
  a: string;
  b: string;
}

export interface DraftAnalysis {
  entered: GameScore[];
  outcome: MatchScoreOutcome;
  /** Game number that decided the match (by games entered so far), or null. */
  decidedAt: number | null;
  /** Red message per game number. */
  gameErrors: Record<number, string>;
}

export const emptyDraft = (format: ScoreFormat): GameDraft[] => Array.from({ length: format.bestOf }, () => ({ a: '', b: '' }));

export function draftFromDetail(detail: MatchDetail): GameDraft[] {
  const draft = emptyDraft(detail.format);
  for (const game of detail.games) {
    const slot = draft[game.number - 1];
    if (slot) draft[game.number - 1] = { a: String(game.score1), b: String(game.score2) };
  }
  return draft;
}

const GAME_RULE_CODES = new Set(['GAME_NOT_FINISHED', 'GAME_MARGIN', 'GAME_OVERRUN']);

/** The game rule in words with examples, built from the match format. */
export function gameRuleHint({ pointsPerGame: points, winBy }: ScoreFormat): string {
  const base = `${points}–${Math.max(points - winBy, 0)}`;
  const extended = winBy > 1 ? `, ${points + 1}–${points + 1 - winBy}` : '';
  return `Quy tắc: thắng ván khi đạt ${points} điểm và hơn ${winBy} điểm (ví dụ ${base}${extended})`;
}

const filled = (game: GameDraft): boolean => game.a !== '' && game.b !== '';

export function analyzeDraft(draft: readonly GameDraft[], format: ScoreFormat): DraftAnalysis {
  const entered: GameScore[] = [];
  for (const game of draft) {
    if (!filled(game)) break;
    entered.push({ score1: Number(game.a), score2: Number(game.b) });
  }
  const outcome = validateMatchScore({ games: entered, format, resultType: 'NORMAL' });
  const gameErrors: Record<number, string> = {};
  for (const issue of outcome.issues) {
    if (issue.game !== undefined) gameErrors[issue.game] = `${issue.message}${GAME_RULE_CODES.has(issue.code) ? `. ${gameRuleHint(format)}` : ''}`;
  }
  const need = gamesToWin(format);
  const wins = { 1: 0, 2: 0 };
  let decidedAt: number | null = null;
  entered.forEach((game, index) => {
    if (decidedAt !== null || checkGame(game, format, index + 1)) return;
    wins[game.score1 > game.score2 ? 1 : 2] += 1;
    if (wins[1] === need || wins[2] === need) decidedAt = index + 1;
  });
  draft.forEach((game, index) => {
    const number = index + 1;
    if (number > entered.length + 1 && (game.a !== '' || game.b !== '')) gameErrors[number] = `Ván ${number}: nhập các ván theo thứ tự`;
  });
  return { entered, outcome, decidedAt, gameErrors };
}

export function confirmSummary(winnerName: string, outcome: MatchScoreOutcome, games: readonly GameScore[]): string {
  const winnerGames = outcome.winnerSide === 1 ? outcome.games1 : outcome.games2;
  const loserGames = outcome.winnerSide === 1 ? outcome.games2 : outcome.games1;
  return `${winnerName} thắng ${winnerGames}–${loserGames} (${games.map((game) => `${game.score1}–${game.score2}`).join(', ')})`;
}

const half = (game: GameDraft): boolean => (game.a === '') !== (game.b === '');

/** Why the confirm button is off, in words that say what to fix; null when the result can be confirmed. */
export function confirmBlockReason(draft: readonly GameDraft[], analysis: DraftAnalysis): string | null {
  if (analysis.outcome.valid) return null;
  const errored = Object.keys(analysis.gameErrors).map(Number).sort((a, b) => a - b)[0];
  if (errored !== undefined) return `Sửa ván ${errored} để xác nhận`;
  const partial = draft.findIndex(half);
  if (partial >= 0) return `Nhập đủ điểm hai bên ở ván ${partial + 1} để xác nhận`;
  return analysis.entered.length === 0 ? 'Nhập tỷ số các ván để xác nhận' : `${analysis.outcome.issues[0]?.message ?? 'Chưa đủ ván'}; nhập tiếp ván ${analysis.entered.length + 1}`;
}
