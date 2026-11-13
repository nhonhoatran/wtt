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
    if (issue.game !== undefined) gameErrors[issue.game] = issue.message;
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
