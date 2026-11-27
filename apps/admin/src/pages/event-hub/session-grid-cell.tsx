import { CloseOutlined, HolderOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Flex, Tag, Tooltip, Typography, theme } from 'antd';
import { MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName } from '../results/match-types';
import { roundTitle } from './draw-labels';
import { CONFLICT_NOTE_ATTRIBUTE } from './schedule-status-bar';
import { conflictText, timeInZone, type ScheduleMatch, type SessionTable } from './schedule-types';
import { DRAGGABLE_ROLE_DESCRIPTION } from './schedule-dnd-accessibility';
import type { SlotTarget, useScheduleBoard } from './use-schedule-board';
import { scheduleDisciplineColor } from './schedule-discipline-colors';

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
    <Flex vertical gap={token.marginXXS} style={{
      minWidth: 0, flex: 1, overflowWrap: 'anywhere',
      borderInlineStart: `${token.lineWidthBold * 2}px solid ${scheduleDisciplineColor(match.discipline?.colorHex) ?? token.colorBorderSecondary}`,
      paddingInlineStart: token.paddingXXS,
    }}>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        #{match.matchNo} · {match.subEventCode} · {roundTitle(match.roundCode)}
        {match.groupCode ? ` · Bảng ${match.groupCode}` : ''}
      </Typography.Text>
      <Typography.Text strong>
        {sideName(match.side1)}
      </Typography.Text>
      <Typography.Text strong>
        {sideName(match.side2)}
      </Typography.Text>
      <Flex gap="small" align="center">
        {match.status !== 'SCHEDULED' && (
          <Tag color={MATCH_STATUS_COLORS[match.status]} style={{ marginInlineEnd: 0 }}>
            {MATCH_STATUS_LABELS[match.status]}
          </Tag>
        )}
        {match.scheduledAt && <Typography.Text type="secondary">{timeInZone(match.scheduledAt, timeZone)}</Typography.Text>}
      </Flex>
    </Flex>
  );
}

type FrameKind = 'filled' | 'warn' | 'empty';

function SlotFrame({ children, kind, over }: { children: React.ReactNode; kind: FrameKind; over: boolean }) {
  const { token } = theme.useToken();
  const color = kind === 'warn' ? token.colorError : over ? token.colorPrimary : token.colorBorder;
  return (
    <div
      style={{
        padding: token.paddingXXS,
        borderRadius: token.borderRadius,
        border: `${token.lineWidth}px ${kind === 'empty' || over ? 'dashed' : token.lineType} ${color}`,
        background: kind === 'warn' ? token.colorErrorBg : over ? token.colorPrimaryBg : undefined,
        minHeight: token.controlHeightLG * 2,
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
      <SlotFrame kind={conflicts.length > 0 ? 'warn' : 'filled'} over={drop.isOver}>
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
              <Flex align="start" gap={token.marginXXS} style={{ width: '100%' }}>
                {body}
                <HolderOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
              </Flex>
            </Button>
            <Button type="text" size="small" icon={<CloseOutlined />} disabled={board.busy} aria-label={`Bỏ xếp trận #${match.matchNo}`} onClick={() => board.unschedule(match)} />
          </Flex>
        ) : (
          <div style={{ padding: token.paddingXXS }}>{body}</div>
        )}
        {conflicts.length > 0 && (
          <Tooltip trigger={['hover', 'focus']} title={conflicts.map((conflict) => <div key={`${conflict.kind}-${conflict.withMatchId}`}>{conflictText(conflict)}</div>)}>
            <Typography.Text
              {...{ [CONFLICT_NOTE_ATTRIBUTE]: true }}
              tabIndex={0}
              role="note"
              aria-label={`${conflicts.length} cảnh báo trùng lịch: ${conflicts.map(conflictText).join('; ')}`}
              style={{ color: token.colorError }}
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
  const { token } = theme.useToken();
  const target: SlotTarget = { sessionId, tableId: table.tableId, order, occupant: null };
  const drop = useDroppable({ id: slotDropId(table.tableId, order), disabled: !canUpdate, data: { target } });
  const armed = canUpdate && board.picked !== null;
  return (
    <div ref={drop.setNodeRef}>
      <SlotFrame kind="empty" over={drop.isOver}>
        {armed ? (
          <Button type="dashed" block size="small" disabled={board.busy} onClick={() => board.moveTo(board.picked!, target)}>
            Xếp vào đây
          </Button>
        ) : (
          <Flex align="center" justify="center" style={{ minHeight: token.controlHeightLG * 2 - token.paddingXS }}>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              <PlusOutlined aria-hidden /> Thả trận vào đây
            </Typography.Text>
          </Flex>
        )}
      </SlotFrame>
    </div>
  );
}

export function GridSlot(props: SlotProps) {
  return props.match ? <PlacedSlot {...props} match={props.match} /> : <EmptySlot {...props} />;
}
