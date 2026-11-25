import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Flex, Progress, Typography } from 'antd';
import { countConflictedMatches } from './schedule-conflict-count';
import { eventProgressQuery } from './use-event-progress';
import { useSessionGridMatches } from './use-session-grid-matches';

const PROGRESS_WIDTH = 160;

export const CONFLICT_NOTE_ATTRIBUTE = 'data-schedule-conflict';

interface ScheduleStatusBarProps {
  eventId: string;
  sessionId: string;
  canUpdate: boolean;
}

const focusFirstConflict = () => document.querySelector<HTMLElement>(`[${CONFLICT_NOTE_ATTRIBUTE}]`)?.focus();

/** Event-wide "scheduled / total" progress, the clash count of the shown session and the autosave hint. */
export function ScheduleStatusBar({ eventId, sessionId, canUpdate }: ScheduleStatusBarProps) {
  const progress = useQuery(eventProgressQuery(eventId));
  const grid = useSessionGridMatches(eventId, sessionId);
  const conflicts = countConflictedMatches(grid.data?.data ?? []);
  const matches = progress.data?.matches;
  const percent = matches && matches.total > 0 ? Math.round((matches.scheduled / matches.total) * 100) : 0;

  return (
    <Flex gap="middle" align="center" wrap justify="space-between">
      <Flex gap="small" align="center" wrap>
        {matches && (
          <>
            <Typography.Text>
              Đã xếp <Typography.Text strong>{matches.scheduled}/{matches.total}</Typography.Text> trận
            </Typography.Text>
            <Progress percent={percent} showInfo={false} style={{ width: PROGRESS_WIDTH, margin: 0 }} size={{ height: 6 }} aria-label="Tiến độ xếp lịch" />
          </>
        )}
        {canUpdate && <Typography.Text type="secondary">Thay đổi được lưu ngay</Typography.Text>}
      </Flex>
      {conflicts > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`Có ${conflicts} trận trùng giờ cần sửa trong buổi này`}
          action={
            <Button size="small" type="link" onClick={focusFirstConflict}>
              Đến ô đầu tiên
            </Button>
          }
        />
      )}
    </Flex>
  );
}
