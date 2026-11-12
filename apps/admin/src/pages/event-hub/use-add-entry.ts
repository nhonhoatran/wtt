import { App } from 'antd';
import { useRef, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import type { Gender, PlayerLookupItem } from '../../resources/players/player-labels';
import { showWarnings, type EntryRecord, type EntryStage, type EntryWriteResult } from './entry-labels';

export interface AddEntryFeedback {
  messages: string[];
  /** Every issue can be overridden by an ADMIN with a reason. */
  overridable: boolean;
}

interface AddBody {
  playerIds: string[];
  stage: EntryStage;
}

/** POST an entry; a refusal is kept as feedback under the lookup so the operator can fix it or override it. */
export function useAddEntry(subEventId: string, onAdded: () => Promise<unknown>) {
  const { message } = App.useApp();
  const [feedback, setFeedback] = useState<AddEntryFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const last = useRef<AddBody | null>(null);

  const send = async (body: AddBody & { overrideReason?: string }): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await apiFetch<EntryWriteResult<EntryRecord>>(`/admin/sub-events/${subEventId}/entries`, { method: 'POST', body });
      setFeedback(null);
      message.success(`Đã thêm ${res.data.competitor.displayName}`);
      showWarnings(message, res.warnings);
      await onAdded();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ENTRY_INELIGIBLE' && error.issues?.length) {
        setFeedback({ messages: error.issues.map((issue) => issue.message), overridable: error.issues.every((issue) => issue.overridable) });
      } else {
        setFeedback({ messages: [error instanceof ApiError ? error.message : 'Không thêm được, thử lại'], overridable: false });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const add = (playerIds: string[], stage: EntryStage) => {
    last.current = { playerIds, stage };
    return send(last.current);
  };

  const addWithReason = (overrideReason: string) => (last.current ? send({ ...last.current, overrideReason }) : Promise.resolve(false));

  const createPlayer = async (fullName: string, gender: Gender): Promise<PlayerLookupItem | null> => {
    try {
      const res = await apiFetch<{ data: PlayerLookupItem }>('/admin/players', { method: 'POST', body: { fullName, gender } });
      message.success(`Đã tạo VĐV ${res.data.code} – ${res.data.fullName}`);
      return res.data;
    } catch (error) {
      const text = error instanceof ApiError ? (Object.values(error.errors ?? {})[0] ?? error.message) : 'Không tạo được VĐV';
      setFeedback({ messages: [text], overridable: false });
      return null;
    }
  };

  return { add, addWithReason, createPlayer, feedback, clearFeedback: () => setFeedback(null), saving };
}
