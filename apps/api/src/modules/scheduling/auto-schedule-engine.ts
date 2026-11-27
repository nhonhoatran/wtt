import { autoScheduleDependencies } from './auto-schedule-dependencies.js';
import { computeScheduleConflicts, type ConflictSideInput } from './schedule-conflict.js';
import type { AutoMatch, AutoPlan, AutoSession, AutoSkipReason } from './auto-schedule-types.js';

const MINUTE = 60_000;
const playable = (m: AutoMatch) => !m.isVoided && m.resultType !== 'BYE' && m.resultType !== 'WALKOVER';

/** Append to the existing gapless table queues. Never move a reservation or invent an idle-time slot. */
export function planAutoSchedule(matches: AutoMatch[], sessions: AutoSession[], minRest: number, cap: number): AutoPlan {
  const { players, dependencies } = autoScheduleDependencies(matches);
  const allPlayers = [...new Map(matches.flatMap((m) => m.sides.flatMap((s) => s.players)).map((p) => [p.id, p])).values()];
  const reservations = new Map<string, ConflictSideInput>();
  const byPlayer = new Map<string, Set<string>>();
  const byTable = new Map<string, Set<string>>();
  const add = (input: ConflictSideInput) => {
    reservations.set(input.matchId, input);
    for (const p of input.players) {
      if (!byPlayer.has(p.id)) byPlayer.set(p.id, new Set());
      byPlayer.get(p.id)!.add(input.matchId);
    }
    if (input.tableId) {
      if (!byTable.has(input.tableId)) byTable.set(input.tableId, new Set());
      byTable.get(input.tableId)!.add(input.matchId);
    }
  };
  const livePlayers = new Set(matches.filter((m) => playable(m) && m.status === 'LIVE').flatMap((m) => (players.get(m.id) ?? allPlayers).map((p) => p.id)));
  for (const m of matches) {
    const at = m.startedAt ?? m.scheduledAt ?? (m.status === 'OFFICIAL' && m.officialAt !== null ? m.officialAt - m.durationMinutes * MINUTE : null);
    if (playable(m) && at !== null && (m.sessionId || m.status === 'OFFICIAL')) {
      // An unresolved existing qualifier could contain any entrant; reserve conservatively.
      const end = Math.max(at + m.durationMinutes * MINUTE, m.officialAt ?? 0);
      add({ matchId: m.id, matchNo: m.matchNo, tableId: m.tableId, startsAt: new Date(at), durationMinutes: (end - at) / MINUTE, players: players.get(m.id) ?? allPlayers });
    }
  }
  const counts = new Map(sessions.map((s) => [s.id, matches.filter((m) => !m.isVoided && m.sessionId === s.id).length]));
  const slots = sessions.flatMap((session) => session.tables.map((table) => {
    const queue = matches.filter((m) => !m.isVoided && m.sessionId === session.id && m.tableId === table.id)
      .sort((a, b) => (a.orderInSession ?? 0) - (b.orderInSession ?? 0) || a.id.localeCompare(b.id));
    let cursor = session.start;
    for (const m of queue) {
      const duration = playable(m) ? m.durationMinutes * MINUTE : 0;
      cursor = Math.max(cursor + duration, (m.scheduledAt ?? cursor) + duration, (m.startedAt ?? 0) + duration, m.officialAt ?? 0);
    }
    return { session, table, cursor, order: Math.max(0, ...queue.map((m) => m.orderInSession ?? 0)) + 1 };
  }));
  const pending = matches.filter((m) => playable(m) && m.published && m.status === 'SCHEDULED' && m.sessionId === null)
    .sort((a, b) => a.round - b.round || a.matchNo - b.matchNo || a.id.localeCompare(b.id));
  const assignments: AutoPlan['assignments'] = [];
  const reasons = new Map<string, AutoSkipReason>();
  const endOf = (m: AutoMatch) => {
    const reservation = reservations.get(m.id);
    if (reservation) return Math.max(reservation.startsAt.getTime() + reservation.durationMinutes * MINUTE, m.officialAt ?? 0);
    return m.status === 'OFFICIAL' ? m.officialAt : null;
  };
  let progress = true;
  while (progress && pending.length) {
    progress = false;
    for (let i = 0; i < pending.length;) {
      const m = pending[i]!;
      const possible = players.get(m.id);
      if (!possible) { reasons.set(m.id, 'UNRESOLVED_PLAYERS'); i++; continue; }
      // A live match has no reliable finish yet, including when it was started without a schedule.
      if (possible.some((p) => livePlayers.has(p.id))) { reasons.set(m.id, 'NO_COMPATIBLE_SLOT'); i++; continue; }
      const feeders = dependencies.get(m.id);
      if (!feeders || feeders.some((f) => endOf(f) === null)) { reasons.set(m.id, 'DEPENDENCY_NOT_SCHEDULED'); i++; continue; }
      const ready = Math.max(0, ...feeders.map((f) => endOf(f)! + minRest * MINUTE));
      const relevant = new Set(possible.flatMap((p) => [...(byPlayer.get(p.id) ?? [])]));
      const target = [...slots].sort((a, b) => a.cursor - b.cursor || a.session.id.localeCompare(b.session.id) || a.table.order - b.table.order || a.table.id.localeCompare(b.table.id)).find((slot) => {
        if (slot.cursor < ready || slot.cursor + m.durationMinutes * MINUTE > slot.session.end || slot.order > cap || counts.get(slot.session.id)! >= cap) return false;
        const ids = new Set([...relevant, ...(byTable.get(slot.table.id) ?? [])]);
        const input = { matchId: m.id, matchNo: m.matchNo, tableId: slot.table.id, startsAt: new Date(slot.cursor), durationMinutes: m.durationMinutes, players: possible };
        return !computeScheduleConflicts([input, ...[...ids].map((id) => reservations.get(id)!)], minRest).has(m.id);
      });
      if (!target) { reasons.set(m.id, 'NO_COMPATIBLE_SLOT'); i++; continue; }
      const scheduledAt = new Date(target.cursor).toISOString();
      assignments.push({ matchId: m.id, matchNo: m.matchNo, sessionId: target.session.id, sessionCode: target.session.code, tableId: target.table.id, tableCode: target.table.code, orderInSession: target.order++, scheduledAt });
      add({ matchId: m.id, matchNo: m.matchNo, tableId: target.table.id, startsAt: new Date(target.cursor), durationMinutes: m.durationMinutes, players: possible });
      target.cursor += m.durationMinutes * MINUTE;
      counts.set(target.session.id, counts.get(target.session.id)! + 1);
      pending.splice(i, 1);
      progress = true;
    }
  }
  return { assignments, skipped: pending.map((m) => ({ matchId: m.id, matchNo: m.matchNo, reason: reasons.get(m.id) ?? 'NO_COMPATIBLE_SLOT' })) };
}
