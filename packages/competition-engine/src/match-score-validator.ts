export interface ScoreFormat {
  bestOf: number;
  pointsPerGame: number;
  winBy: number;
}

export interface GameScore {
  score1: number;
  score2: number;
}

export type ScoredResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED';

export interface ScoreIssue {
  code: string;
  /** 1-based game number when the issue belongs to one game. */
  game?: number;
  message: string;
}

export interface MatchScoreInput {
  games: readonly GameScore[];
  format: ScoreFormat;
  resultType: ScoredResultType;
  /** Required for WALKOVER / RETIRED / DISQUALIFIED; checked against the games for NORMAL. */
  winnerSide?: 1 | 2 | null;
}

export interface MatchScoreOutcome {
  valid: boolean;
  issues: ScoreIssue[];
  winnerSide: 1 | 2 | null;
  /** Completed games won by each side; a partial last game of a retirement is not counted. */
  games1: number;
  games2: number;
}

export const gamesToWin = (format: Pick<ScoreFormat, 'bestOf'>): number => Math.ceil(format.bestOf / 2);

/** Null when the game is a finished, legal game; otherwise why not. */
export function checkGame(game: GameScore, format: ScoreFormat, number: number): ScoreIssue | null {
  const { score1: a, score2: b } = game;
  const label = `Ván ${number}: ${a}–${b}`;
  if (![a, b].every((s) => Number.isInteger(s) && s >= 0)) return { code: 'GAME_SCORE_INVALID', game: number, message: `Ván ${number}: điểm phải là số nguyên không âm` };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const { pointsPerGame: target, winBy } = format;
  if (hi < target) return { code: 'GAME_NOT_FINISHED', game: number, message: `${label} chưa đủ ${target} điểm` };
  if (hi === target && lo <= target - winBy) return null;
  if (hi > target && winBy > 1 && hi - lo === winBy) return null;
  if (hi - lo < winBy) return { code: 'GAME_MARGIN', game: number, message: `${label} chưa đủ cách ${winBy} điểm` };
  return { code: 'GAME_OVERRUN', game: number, message: `${label} vượt quá điểm kết thúc ván` };
}

const winnerOfGame = (game: GameScore): 1 | 2 => (game.score1 > game.score2 ? 1 : 2);

/**
 * Validates a whole match result against its format. NORMAL needs every game legal and the winner at
 * ceil(bestOf/2) games with nothing played after; RETIRED/DISQUALIFIED allow a partial last game and an
 * explicit winner short of that; WALKOVER takes no games.
 */
export function validateMatchScore(input: MatchScoreInput): MatchScoreOutcome {
  const { games, format, resultType } = input;
  const need = gamesToWin(format);
  const issues: ScoreIssue[] = [];
  const wins = { 1: 0, 2: 0 };
  let decidedAt: number | null = null;

  if (resultType === 'WALKOVER' && games.length) issues.push({ code: 'WALKOVER_HAS_GAMES', message: 'Trận không đến không có tỷ số ván' });
  if (games.length > format.bestOf) issues.push({ code: 'TOO_MANY_GAMES', message: `Thể thức chỉ có tối đa ${format.bestOf} ván` });

  const partialAllowed = resultType === 'RETIRED' || resultType === 'DISQUALIFIED';
  games.forEach((game, index) => {
    const number = index + 1;
    const issue = checkGame(game, format, number);
    const isLast = number === games.length;
    if (issue) {
      const partialLast = partialAllowed && isLast && issue.code !== 'GAME_SCORE_INVALID' && issue.code !== 'GAME_OVERRUN';
      if (!partialLast) issues.push(issue);
      return;
    }
    if (decidedAt !== null) {
      issues.push({ code: 'GAME_AFTER_DECIDED', game: number, message: `Ván ${number}: trận đã kết thúc ở ván ${decidedAt}` });
      return;
    }
    const side = winnerOfGame(game);
    wins[side] += 1;
    if (wins[side] === need) decidedAt = number;
  });

  const derived: 1 | 2 | null = wins[1] === need ? 1 : wins[2] === need ? 2 : null;
  let winnerSide: 1 | 2 | null = derived;

  if (resultType === 'NORMAL') {
    if (derived === null) issues.push({ code: 'MATCH_NOT_DECIDED', message: `Chưa bên nào thắng đủ ${need} ván` });
    if (input.winnerSide && derived && input.winnerSide !== derived) issues.push({ code: 'WINNER_MISMATCH', message: 'Bên thắng không khớp với tỷ số các ván' });
  } else {
    winnerSide = input.winnerSide ?? null;
    if (!winnerSide) issues.push({ code: 'WINNER_REQUIRED', message: 'Chọn bên thắng' });
    if (partialAllowed && derived !== null) {
      issues.push({ code: 'MATCH_ALREADY_DECIDED', message: 'Các ván đã đủ để kết thúc trận; chọn "Kết quả thường"' });
    }
  }

  return { valid: issues.length === 0, issues, winnerSide, games1: wins[1], games2: wins[2] };
}

/**
 * Saved-but-unconfirmed games of a live match: every game but the last must be a finished legal game,
 * the last may still be in play, and nothing may follow a decided match.
 */
export function validateProgressGames(games: readonly GameScore[], format: ScoreFormat): ScoreIssue[] {
  const issues: ScoreIssue[] = [];
  if (games.length > format.bestOf) issues.push({ code: 'TOO_MANY_GAMES', message: `Thể thức chỉ có tối đa ${format.bestOf} ván` });
  const need = gamesToWin(format);
  const wins = { 1: 0, 2: 0 };
  games.forEach((game, index) => {
    const number = index + 1;
    if (wins[1] === need || wins[2] === need) {
      issues.push({ code: 'GAME_AFTER_DECIDED', game: number, message: `Ván ${number}: trận đã kết thúc ở ván ${number - 1}` });
      return;
    }
    const issue = checkGame(game, format, number);
    if (issue) {
      const inPlay = number === games.length && issue.code !== 'GAME_SCORE_INVALID' && issue.code !== 'GAME_OVERRUN';
      if (!inPlay) issues.push(issue);
      return;
    }
    wins[winnerOfGame(game)] += 1;
  });
  return issues;
}
