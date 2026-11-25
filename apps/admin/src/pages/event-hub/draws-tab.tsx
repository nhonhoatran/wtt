import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Empty, Flex, Result, Skeleton } from 'antd';
import { Link } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DrawPanel } from './draw-panel';
import { DRAW_VIEW_KEY, drawSectionTitle, drawsOverviewKey, OVERALL_BADGE_STATUS, OVERALL_LABELS, overallDrawState, overviewOf } from './draw-labels';
import type { DrawKind, DrawOverviewRow } from './draw-types';
import type { EntrySubEvent } from './entry-labels';
import type { HubTabContext } from './hub-tab-context';
import { subEventsKey } from './sub-event-labels';
import { SubEventPills, useSubEventParam } from './sub-event-pills';

const kindsOf = (subEvent: EntrySubEvent): DrawKind[] => [
  ...(subEvent.format === 'GROUP_KNOCKOUT' ? (['GROUP'] as const) : []),
  ...(subEvent.hasQualifying ? (['QUALIFYING'] as const) : []),
  'MAIN',
];

const jumpTo = (kind: DrawKind) => document.querySelector(`[data-draw-kind="${kind}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** "Bốc thăm" tab: pick a sub-event with the pills, then every draw kind of it stacked as sections; the pick stays in ?subEvent=. */
export function DrawsTab({ event, canCreate, canUpdate }: HubTabContext) {
  const queryClient = useQueryClient();
  const subEvents = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntrySubEvent[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });
  const overview = useQuery({
    queryKey: drawsOverviewKey(event.id),
    queryFn: async () => (await apiFetch<{ data: DrawOverviewRow[] }>(`/admin/events/${event.id}/draws`)).data,
  });
  const [selected, select] = useSubEventParam(subEvents.data ?? []);

  if (subEvents.isLoading) return <Skeleton active />;
  if (subEvents.isError || !subEvents.data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => subEvents.refetch()}>Thử lại</Button>} />;
  }
  if (!selected) {
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

  const refresh = () => Promise.all([overview.refetch(), queryClient.invalidateQueries({ queryKey: [DRAW_VIEW_KEY] })]);
  const draws = overviewOf(overview.data, selected.id)?.draws ?? [];
  const kinds = kindsOf(selected);

  return (
    <Flex vertical gap="large">
      <SubEventPills
        subEvents={subEvents.data}
        selectedId={selected.id}
        onSelect={select}
        renderMeta={(id) => {
          if (!overview.data) return null;
          const state = overallDrawState(overviewOf(overview.data, id)?.draws);
          return (
            <span role="img" aria-label={`Bốc thăm: ${OVERALL_LABELS[state]}`} title={OVERALL_LABELS[state]}>
              <Badge status={OVERALL_BADGE_STATUS[state]} />
            </span>
          );
        }}
      />
      {kinds.length > 1 && !overview.isError && (
        <Flex gap="small" align="center" wrap aria-label="Đi tới phần">
          {kinds.map((kind) => (
            <Button key={kind} size="small" onClick={() => jumpTo(kind)}>
              {drawSectionTitle(kind, selected.format)}
            </Button>
          ))}
        </Flex>
      )}
      {overview.isLoading ? (
        <Skeleton active />
      ) : overview.isError ? (
        <Result status="error" title="Không tải được trạng thái bốc thăm" extra={<Button onClick={() => overview.refetch()}>Thử lại</Button>} />
      ) : (
        kinds.map((kind) => <DrawPanel key={`${selected.id}-${kind}`} subEvent={selected} kind={kind} draws={draws} canUpdate={canUpdate} refresh={refresh} />)
      )}
    </Flex>
  );
}
