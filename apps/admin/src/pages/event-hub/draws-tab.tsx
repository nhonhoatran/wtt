import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Flex, Result, Skeleton, Space, Tabs, Tag, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DrawPanel } from './draw-panel';
import { DRAW_KIND_LABELS, DRAW_VIEW_KEY, drawsOverviewKey, OVERALL_COLORS, OVERALL_LABELS, overallDrawState, overviewOf } from './draw-labels';
import type { DrawKind, DrawOverviewRow } from './draw-types';
import { SIDE_MENU_WIDTH, SUB_EVENT_QUERY_PARAM, type EntrySubEvent } from './entry-labels';
import type { HubTabContext } from './hub-tab-context';
import { subEventsKey, subEventTitle } from './sub-event-labels';
import { SubEventSideMenu } from './sub-event-side-menu';

const kindsOf = (subEvent: EntrySubEvent): DrawKind[] => [
  ...(subEvent.format === 'GROUP_KNOCKOUT' ? (['GROUP'] as const) : []),
  ...(subEvent.hasQualifying ? (['QUALIFYING'] as const) : []),
  'MAIN',
];

/** "Bốc thăm" tab: pick a sub-event on the left, manage its draws on the right; the pick stays in ?subEvent=. */
export function DrawsTab({ event, canCreate, canUpdate }: HubTabContext) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const subEvents = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntrySubEvent[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });
  const overview = useQuery({
    queryKey: drawsOverviewKey(event.id),
    queryFn: async () => (await apiFetch<{ data: DrawOverviewRow[] }>(`/admin/events/${event.id}/draws`)).data,
  });

  if (subEvents.isLoading) return <Skeleton active />;
  if (subEvents.isError || !subEvents.data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => subEvents.refetch()}>Thử lại</Button>} />;
  }
  if (subEvents.data.length === 0) {
    return (
      <Empty description="Chưa có nội dung">
        {canCreate && (
          <Link to={`/events/${event.id}/sub-events`}>
            <Button type="primary" icon={<PlusOutlined />}>
              Thêm nội dung
            </Button>
          </Link>
        )}
      </Empty>
    );
  }

  const selected = subEvents.data.find((row) => row.id === params.get(SUB_EVENT_QUERY_PARAM)) ?? subEvents.data[0]!;
  const select = (id: string) =>
    setParams((current) => {
      current.set(SUB_EVENT_QUERY_PARAM, id);
      return current;
    });
  const refresh = () => Promise.all([overview.refetch(), queryClient.invalidateQueries({ queryKey: [DRAW_VIEW_KEY] })]);
  const draws = overviewOf(overview.data, selected.id)?.draws ?? [];
  const stateOf = (subEventId: string) => overallDrawState(overviewOf(overview.data, subEventId)?.draws);
  const state = stateOf(selected.id);
  const kinds = kindsOf(selected);
  const panel = (kind: DrawKind) => <DrawPanel key={`${selected.id}-${kind}`} subEvent={selected} kind={kind} draws={draws} canUpdate={canUpdate} refresh={refresh} />;

  return (
    <Flex gap="middle" align="start">
      <div style={{ width: SIDE_MENU_WIDTH, flex: 'none' }}>
        <SubEventSideMenu
          subEvents={subEvents.data}
          selectedId={selected.id}
          onSelect={select}
          renderStatus={(id) => overview.data && <Tag color={OVERALL_COLORS[stateOf(id)]}>{OVERALL_LABELS[stateOf(id)]}</Tag>}
        />
      </div>
      <Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}>
        <Space align="center" wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {subEventTitle(selected)}
          </Typography.Title>
          <Tag>{selected.code}</Tag>
          {overview.data && <Tag color={OVERALL_COLORS[state]}>{OVERALL_LABELS[state]}</Tag>}
        </Space>
        {overview.isError && (
          <Alert type="warning" showIcon message="Không tải được trạng thái bốc thăm." action={<Button size="small" onClick={() => overview.refetch()}>Thử lại</Button>} />
        )}
        {overview.isLoading ? (
          <Skeleton active />
        ) : kinds.length === 1 ? (
          panel(kinds[0]!)
        ) : (
          <Tabs key={selected.id} size="small" items={kinds.map((kind) => ({ key: kind, label: DRAW_KIND_LABELS[kind], children: panel(kind) }))} />
        )}
      </Flex>
    </Flex>
  );
}
