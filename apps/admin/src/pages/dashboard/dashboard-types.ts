export interface DashboardEvent {
  id: string;
  name: string;
  eventType: { name: string; colorHex: string | null; tier: { name: string; colorHex: string } };
  startDate: string;
  endDate: string;
  venue: { name: string; city: string | null } | null;
  matches: { total: number; official: number };
}

export interface DashboardSummary {
  liveEvents: number;
  pendingToday: number;
  overdueToday: number;
  finishedToday: number;
  activePlayers: number;
  /** From the dashboard.recentActivityLimit setting; 0 hides the activity block. */
  recentActivityLimit: number;
  events: DashboardEvent[];
}

interface PendingSide {
  displayName: string;
  players: { id: string; fullName: string }[];
}

export interface PendingMatchRow {
  id: string;
  matchNo: number;
  eventId: string;
  eventName: string;
  scheduledAt: string | null;
  timezone: string;
  table: { code: string; displayName: string | null } | null;
  subEvent: { code: string; name: string };
  round: { code: string };
  side1: PendingSide | null;
  side2: PendingSide | null;
  status: 'SCHEDULED' | 'LIVE';
}

export interface PendingMatchesPage {
  data: PendingMatchRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecentActivityRow {
  id: string;
  actorType: 'USER' | 'SYSTEM';
  actorId: string;
  actorName: string | null;
  action: string;
  createdAt: string;
}

export const DASHBOARD_SUMMARY_KEY = ['dashboard-summary'];
export const pendingMatchesKey = (page: number, pageSize: number | undefined) => ['dashboard-pending-matches', page, pageSize];
export const recentActivityKey = (limit: number) => ['dashboard-recent-activity', limit];
