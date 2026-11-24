import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Flex, Result, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DAY_QUERY_PARAM, SESSION_QUERY_PARAM } from './entry-labels';
import type { HubTabContext } from './hub-tab-context';
import { ScheduleActions } from './schedule-actions';
import { SideMenuLayout } from './side-menu-layout';
import { scheduleAnnouncements, scheduleScreenReaderInstructions } from './schedule-dnd-accessibility';
import { scheduleKey, sessionsKey, tableLabel, todayInZone, type ScheduleMatch, type SessionRecord } from './schedule-types';
import { SessionFormModal } from './session-form-modal';
import { SessionGrid } from './session-grid';
import { SessionToolbar } from './session-toolbar';
import { UnscheduledPanel } from './unscheduled-panel';
import { useScheduleBoard, type SlotTarget } from './use-schedule-board';

const DRAG_START_DISTANCE = 6;
const STACKED_PANEL_MAX_HEIGHT = '50vh';
const PANEL_COLUMN = { display: 'flex', flexDirection: 'column' } as const;

type Dialog = { session: SessionRecord | null } | null;

function defaultDay(days: string[], ongoing: boolean, timeZone: string): string | undefined {
  const today = todayInZone(timeZone);
  return ongoing && days.includes(today) ? today : days[0];
}

/** "Lịch & kết quả" tab: pick a day and session, then place matches onto its table grid; the pick stays in ?day= and ?session=. */
export function ScheduleTab({ event, canUpdate }: HubTabContext) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const board = useScheduleBoard(event.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dragging, setDragging] = useState<ScheduleMatch | null>(null);
  const { token } = theme.useToken();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE } }));
  const sessions = useQuery({
    queryKey: sessionsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: SessionRecord[] }>(`/admin/events/${event.id}/sessions`)).data,
  });

  const announcements = useMemo(() => {
    const names = new Map((sessions.data ?? []).flatMap((row) => row.tables).map((table) => [table.tableId, tableLabel(table)]));
    return scheduleAnnouncements((tableId) => names.get(tableId) ?? '');
  }, [sessions.data]);

  if (sessions.isLoading) return <Skeleton active />;
  if (sessions.isError || !sessions.data) {
    return <Result status="error" title="Không tải được danh sách buổi thi đấu" extra={<Button onClick={() => sessions.refetch()}>Thử lại</Button>} />;
  }

  const all = sessions.data;
  const select = (day: string | undefined, sessionId?: string) =>
    setParams((current) => {
      if (day) current.set(DAY_QUERY_PARAM, day);
      else current.delete(DAY_QUERY_PARAM);
      if (sessionId) current.set(SESSION_QUERY_PARAM, sessionId);
      else current.delete(SESSION_QUERY_PARAM);
      return current;
    });
  const reloadSessions = () => queryClient.invalidateQueries({ queryKey: sessionsKey(event.id) });

  const days = [...new Set(all.map((session) => session.date))];
  const day = days.includes(params.get(DAY_QUERY_PARAM) ?? '') ? params.get(DAY_QUERY_PARAM)! : defaultDay(days, event.lifecycle === 'ONGOING', event.timezone);
  const ofDay = all.filter((session) => session.date === day);
  const session = ofDay.find((item) => item.id === params.get(SESSION_QUERY_PARAM)) ?? ofDay[0];

  const onDragStart = ({ active }: DragStartEvent) => setDragging((active.data.current?.match as ScheduleMatch | undefined) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const match = active.data.current?.match as ScheduleMatch | undefined;
    const target = over?.data.current?.target as SlotTarget | undefined;
    if (match && target) board.moveTo(match, target);
  };

  const removeSession = async (target: SessionRecord) => {
    await apiFetch(`/admin/events/${event.id}/sessions/${target.id}`, { method: 'DELETE' });
    message.success('Đã xóa buổi thi đấu');
    select(day, undefined);
    await Promise.all([reloadSessions(), queryClient.invalidateQueries({ queryKey: scheduleKey(event.id) })]);
  };

  const closeDialog = () => setDialog(null);

  if (!session) {
    return (
      <>
        <Empty description="Chưa có buổi thi đấu">
          {canUpdate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog({ session: null })}>
              Thêm buổi thi đấu
            </Button>
          )}
        </Empty>
        {dialog && (
          <SessionFormModal event={event} session={null} defaultDate={undefined} onClose={closeDialog} onSaved={(saved) => { closeDialog(); select(saved.date, saved.id); void reloadSessions(); }} />
        )}
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{ announcements, screenReaderInstructions: scheduleScreenReaderInstructions }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <Flex vertical gap="middle">
        <SessionToolbar
          days={days}
          day={day}
          sessionsOfDay={ofDay}
          session={session}
          canUpdate={canUpdate}
          onPick={select}
          onAdd={() => setDialog({ session: null })}
          onEdit={() => setDialog({ session })}
          onDelete={() => removeSession(session)}
        />
        {/* Height-capped so a long panel scrolls inside itself; sticky beside the grid so it stays in view while dragging. */}
        <SideMenuLayout
          side={<UnscheduledPanel eventId={event.id} board={board} canUpdate={canUpdate} />}
          sideStyle={{ ...PANEL_COLUMN, position: 'sticky', top: token.marginMD, maxHeight: `calc(100vh - ${token.marginMD * 2}px)` }}
          stackedSideStyle={{ ...PANEL_COLUMN, maxHeight: STACKED_PANEL_MAX_HEIGHT }}
        >
          <Flex justify="space-between" align="center" wrap gap="small">
            <Space align="center" wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {session.name ?? `Buổi ${session.code}`}
              </Typography.Title>
              <Tag>{session.code}</Tag>
            </Space>
            <ScheduleActions eventId={event.id} sessionId={session.id} canUpdate={canUpdate} />
          </Flex>
          <SessionGrid eventId={event.id} timeZone={event.timezone} session={session} canUpdate={canUpdate} board={board} />
        </SideMenuLayout>
      </Flex>
      <DragOverlay>{dragging && <Tag color="processing">Trận #{dragging.matchNo}</Tag>}</DragOverlay>
      {dialog && (
        <SessionFormModal
          event={event}
          session={dialog.session}
          defaultDate={day}
          onClose={closeDialog}
          onSaved={(saved) => {
            closeDialog();
            select(saved.date, saved.id);
            void reloadSessions();
            void queryClient.invalidateQueries({ queryKey: scheduleKey(event.id) });
          }}
        />
      )}
    </DndContext>
  );
}
