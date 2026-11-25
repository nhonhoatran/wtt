import { Flex, Segmented } from 'antd';
import { ScheduleActions } from './schedule-actions';
import { dayPillLabel, sessionRangeLabel, type SessionRecord } from './schedule-types';
import { SessionHeaderMenu } from './session-header-menu';

// Long pill rows scroll inside themselves instead of widening the page on phones.
const SCROLL_X = { maxWidth: '100%', overflowX: 'auto' } as const;

interface SessionToolbarProps {
  eventId: string;
  days: string[];
  day: string | undefined;
  sessionsOfDay: SessionRecord[];
  session: SessionRecord;
  canUpdate: boolean;
  onPick: (day: string | undefined, sessionId?: string) => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

/** Day and session pills with the session menu, and the print / refresh / export actions on the right. */
export function SessionToolbar({ eventId, days, day, sessionsOfDay, session, canUpdate, onPick, onAdd, onEdit, onDelete }: SessionToolbarProps) {
  return (
    <Flex gap="middle" align="center" justify="space-between" wrap>
      <Flex gap="small" align="center" wrap style={{ minWidth: 0 }}>
        <div style={SCROLL_X}>
          <Segmented aria-label="Ngày thi đấu" value={day} onChange={(value) => onPick(String(value))} options={days.map((value) => ({ value, label: dayPillLabel(value) }))} />
        </div>
        <div style={SCROLL_X}>
          <Segmented aria-label="Buổi thi đấu" value={session.id} onChange={(value) => onPick(day, String(value))} options={sessionsOfDay.map((item) => ({ value: item.id, label: sessionRangeLabel(item) }))} />
        </div>
        {canUpdate && <SessionHeaderMenu session={session} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />}
      </Flex>
      <ScheduleActions eventId={eventId} sessionId={session.id} canUpdate={canUpdate} />
    </Flex>
  );
}
