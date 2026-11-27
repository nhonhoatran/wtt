export interface AutoPlayer { id: string; name: string }
export interface AutoSide { players: AutoPlayer[]; feederNo: number | null }

export interface AutoMatch {
  id: string;
  matchNo: number;
  round: number;
  status: string;
  resultType: string | null;
  isVoided: boolean;
  published: boolean;
  winnerSide: number | null;
  nextMatchId: string | null;
  sessionId: string | null;
  tableId: string | null;
  orderInSession: number | null;
  scheduledAt: number | null;
  startedAt: number | null;
  officialAt: number | null;
  durationMinutes: number;
  sides: [AutoSide, AutoSide];
}

export interface AutoSession {
  id: string;
  code: string;
  start: number;
  end: number;
  tables: { id: string; code: string; order: number }[];
}

export interface AutoAssignment {
  matchId: string;
  matchNo: number;
  sessionId: string;
  sessionCode: string;
  tableId: string;
  tableCode: string;
  orderInSession: number;
  scheduledAt: string;
}

export type AutoSkipReason = 'UNRESOLVED_PLAYERS' | 'DEPENDENCY_NOT_SCHEDULED' | 'NO_COMPATIBLE_SLOT';
export interface AutoSkipped { matchId: string; matchNo: number; reason: AutoSkipReason }
export interface AutoPlan { assignments: AutoAssignment[]; skipped: AutoSkipped[] }

export const AUTO_SKIP_LABELS: Record<AutoSkipReason, string> = {
  UNRESOLVED_PLAYERS: 'Chưa xác định được các VĐV có thể thi đấu',
  DEPENDENCY_NOT_SCHEDULED: 'Trận trước chưa có lịch phù hợp',
  NO_COMPATIBLE_SLOT: 'Không còn chỗ phù hợp với thời lượng, giờ nghỉ và giới hạn buổi',
};
