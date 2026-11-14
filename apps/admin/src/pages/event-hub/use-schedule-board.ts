import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings } from '../../api/write-warnings';
import { matchesKey } from '../results/match-types';
import { scheduleKey, sessionsKey, type ScheduleMatch, type ScheduleResponse } from './schedule-types';

export interface SlotTarget {
  sessionId: string;
  tableId: string;
  order: number;
  /** Match currently in the slot, null when empty. */
  occupant: ScheduleMatch | null;
}

/** Selection plus the one PATCH call behind click-click, drag and "Bỏ xếp"; reloads the grid and panel after every outcome. */
export function useScheduleBoard(eventId: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<ScheduleMatch | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!picked) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPicked(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked]);

  const reload = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKey(eventId) }),
        queryClient.invalidateQueries({ queryKey: sessionsKey(eventId) }),
        queryClient.invalidateQueries({ queryKey: matchesKey(eventId) }),
      ]),
    [queryClient, eventId],
  );

  const send = useCallback(
    async (match: ScheduleMatch, body: Record<string, unknown>, doneText: string) => {
      setBusy(true);
      try {
        const res = await apiFetch<ScheduleResponse>(`/admin/matches/${match.id}/schedule`, {
          method: 'PATCH',
          body: { ...body, expectedScheduleVersion: match.scheduleVersion },
        });
        message.success(doneText);
        const conflictCount = res.data.conflicts?.length ?? 0;
        if (conflictCount > 0) message.warning(`Trận #${match.matchNo} đang trùng lịch (${conflictCount} cảnh báo)`);
        showWarnings(message, res.warnings);
      } catch (error) {
        message.error(error instanceof ApiError ? error.message : 'Không xếp lịch được');
      } finally {
        // Stale-version, occupied-slot and retry errors all mean the screen is out of date; every outcome reloads.
        setPicked(null);
        setBusy(false);
        await reload();
      }
    },
    [message, reload],
  );

  const moveTo = useCallback(
    (match: ScheduleMatch, target: SlotTarget) => {
      if (busy || match.status !== 'SCHEDULED') return;
      if (target.occupant?.id === match.id) return;
      // The API refuses a slotless match onto an occupied slot (SCHEDULE_SLOT_OCCUPIED); do not even ask.
      if (target.occupant && !match.tableId) return;
      const swap = target.occupant !== null;
      void send(
        match,
        { sessionId: target.sessionId, tableId: target.tableId, orderInSession: target.order, expectedOccupantId: target.occupant?.id ?? null },
        swap ? `Đã đổi chỗ trận #${match.matchNo} với trận #${target.occupant!.matchNo}` : `Đã xếp trận #${match.matchNo} vào bàn`,
      );
    },
    [busy, send],
  );

  const unschedule = useCallback((match: ScheduleMatch) => void send(match, { sessionId: null }, `Đã bỏ xếp trận #${match.matchNo}`), [send]);

  return { picked, setPicked, busy, moveTo, unschedule, reload };
}
