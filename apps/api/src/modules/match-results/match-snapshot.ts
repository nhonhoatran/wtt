import type { MatchDetailRow } from '../matches/match-result-view.js';
import { matchStateInvalid } from './match-result-errors.js';

/** Before-image kept in the audit log of every match mutation. */
export const matchSnapshot = (m: MatchDetailRow) => ({
  status: m.status,
  resultType: m.resultType,
  winnerSide: m.winnerSide,
  games1: m.games1,
  games2: m.games2,
  games: m.games,
  version: m.version,
});

export function assertResultEditable(m: Pick<MatchDetailRow, 'resultType' | 'isVoided'>): void {
  if (m.resultType === 'BYE') throw matchStateInvalid('Trận BYE không nhập kết quả');
  if (m.isVoided) throw matchStateInvalid('Trận đã hủy do VĐV rút khỏi bảng');
}
