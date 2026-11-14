import { CloseOutlined, WarningOutlined } from '@ant-design/icons';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Flex, Tag, Tooltip, Typography, theme } from 'antd';
import { MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName } from '../results/match-types';
import { roundTitle } from './draw-labels';
import { conflictText, timeInZone, type ScheduleMatch, type SessionTable } from './schedule-types';
import { DRAGGABLE_ROLE_DESCRIPTION } from './schedule-dnd-accessibility';
import type { SlotTarget, useScheduleBoard } from './use-schedule-board';

export type ScheduleBoard = ReturnType<typeof useScheduleBoard>;

interface SlotProps {
  board: ScheduleBoard;
  canUpdate: boolean;
  timeZone: string;
  sessionId: string;
  table: SessionTable;
  order: number;
  match: ScheduleMatch | null;
}

export const slotDropId = (tableId: string, order: number) => `slot:${tableId}:${order}`;
export const matchDragId = (matchId: string) => `match:${matchId}`;

function MatchBody({ match, timeZone }: { match: ScheduleMatch; timeZone: string }) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.marginXXS} style={{ minWidth: 0, width: '100%' }}>
      <Flex gap="small" align="center" wrap>
        <Typography.Text strong>#{match.matchNo}</Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{match.subEventCode}</Tag>
        <Typography.Text type="secondary">
          {roundTitle(match.roundCode)}
          {match.groupCode ? ` · Bảng ${match.groupCode}` : ''}
        </Typography.Text>
      </Flex>
      <Typography.Text ellipsis>{sideName(match.side1)}</Typography.Text>
      <Typography.Text ellipsis>{sideName(match.side2)}</Typography.Text>
      <Flex gap="small" align="center">
        <Tag color={MATCH_STATUS_COLORS[match.status]} style={{ marginInlineEnd: 0 }}>
          {MATCH_STATUS_LABELS[match.status]}
        </Tag>
        {match.scheduledAt && <Typography.Text type="secondary">{timeInZone(match.scheduledAt, timeZone)}</Typography.Text>}
      </Flex>
    </Flex>
  );
}

function SlotFrame({ children, warn, over }: { children: React.ReactNode; warn: boolean; over: boolean }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: token.paddingXXS,
        borderRadius: token.borderRadius,
        border: `${token.lineWidth}px ${token.lineType} ${warn ? token.colorWarning : 'transparent'}`,
        background: over ? token.colorPrimaryBg : undefined,
      }}
    >
      {children}
    </div>
  );
}

function PlacedSlot({ board, canUpdate, timeZone, sessionId, table, order, match }: SlotProps & { match: ScheduleMatch }) {
  const { token } = theme.useToken();
  const movable = canUpdate && match.status === 'SCHEDULED';
  const target: SlotTarget = { sessionId, tableId: table.tableId, order, occupant: match };
  const { active } = useDndContext();
  // A match without a slot (from the panel) may only fill empty cells; swapping is for matches already placed.
  const held = (active?.data.current?.match as ScheduleMatch | undefined) ?? board.picked;
  const refusesSwap = held !== null && held !== undefined && !held.tableId;
  const drop = useDroppable({ id: slotDropId(table.tableId, order), disabled: !movable || refusesSwap, data: { target } });
  const drag = useDraggable({ id: matchDragId(match.id), disabled: !movable, data: { match } });
  const selected = board.picked?.id === match.id;
  const conflicts = match.conflicts ?? [];

  const onClick = () => {
    if (board.picked?.tableId && board.picked.id !== match.id) board.moveTo(board.picked, target);
    else board.setPicked(selected ? null : match);
  };

  const body = <MatchBody match={match} timeZone={timeZone} />;
  return (
    <div ref={drop.setNodeRef}>
      <SlotFrame warn={conflicts.length > 0} over={drop.isOver}>
        {movable ? (
          <Flex align="start" gap={token.marginXXS}>
            <Button
              ref={drag.setNodeRef}
              {...drag.attributes}
              aria-roledescription={DRAGGABLE_ROLE_DESCRIPTION}
              type="text"
              block
              size="small"
              aria-pressed={selected}
              disabled={board.busy}
              onClick={onClick}
              style={{
                height: 'auto',
                textAlign: 'start',
                whiteSpace: 'normal',
                opacity: drag.isDragging ? token.opacityLoading : undefined,
                cursor: 'grab',
                background: selected ? token.colorPrimaryBg : undefined,
                borderColor: selected ? token.colorPrimary : undefined,
              }}
              {...drag.listeners}
            >
              {body}
            </Button>
            <Button type="text" size="small" icon={<CloseOutlined />} disabled={board.busy} aria-label={`Bỏ xếp trận #${match.matchNo}`} onClick={() => board.unschedule(match)} />
          </Flex>
        ) : (
          <div style={{ padding: token.paddingXXS }}>{body}</div>
        )}
        {conflicts.length > 0 && (
          <Tooltip trigger={['hover', 'focus']} title={conflicts.map((conflict) => <div key={`${conflict.kind}-${conflict.withMatchId}`}>{conflictText(conflict)}</div>)}>
            <Typography.Text
              tabIndex={0}
              role="note"
              aria-label={`${conflicts.length} cảnh báo trùng lịch: ${conflicts.map(conflictText).join('; ')}`}
              style={{ color: token.colorWarning }}
            >
              <WarningOutlined /> {conflicts.length} cảnh báo trùng lịch
            </Typography.Text>
          </Tooltip>
        )}
      </SlotFrame>
    </div>
  );
}

function EmptySlot({ board, canUpdate, sessionId, table, order }: SlotProps) {
  const target: SlotTarget = { sessionId, tableId: table.tableId, order, occupant: null };
  const drop = useDroppable({ id: slotDropId(table.tableId, order), disabled: !canUpdate, data: { target } });
  const armed = canUpdate && board.picked !== null;
  return (
    <div ref={drop.setNodeRef}>
      <SlotFrame warn={false} over={drop.isOver}>
        {armed ? (
          <Button type="dashed" block size="small" disabled={board.busy} onClick={() => board.moveTo(board.picked!, target)}>
            Xếp vào đây
          </Button>
        ) : (
          <Typography.Text type="secondary">Trống</Typography.Text>
        )}
      </SlotFrame>
    </div>
  );
}

export function GridSlot(props: SlotProps) {
  return props.match ? <PlacedSlot {...props} match={props.match} /> : <EmptySlot {...props} />;
}
