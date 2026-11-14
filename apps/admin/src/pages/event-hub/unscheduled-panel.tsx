import { useDraggable } from '@dnd-kit/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Flex, Input, Pagination, Select, Skeleton, Typography, theme } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useDebouncedValue } from '../../components/use-debounced-value';
import { useListPageSize } from '../../providers/use-list-page-size';
import { sideName } from '../results/match-types';
import { roundTitle } from './draw-labels';
import { scheduleKey, type ScheduleMatch } from './schedule-types';
import { DRAGGABLE_ROLE_DESCRIPTION } from './schedule-dnd-accessibility';
import { matchDragId, type ScheduleBoard } from './session-grid-cell';
import { subEventsKey, subEventTitle, type SubEventRecord } from './sub-event-labels';
import { useRoundOptions } from './use-round-options';

const UNSCHEDULED_SEARCH_DEBOUNCE_MS = 300;

function UnscheduledItem({ match, board, canUpdate }: { match: ScheduleMatch; board: ScheduleBoard; canUpdate: boolean }) {
  const { token } = theme.useToken();
  const drag = useDraggable({ id: matchDragId(match.id), disabled: !canUpdate, data: { match } });
  const selected = board.picked?.id === match.id;
  return (
    <Button
      ref={drag.setNodeRef}
      {...drag.attributes}
      aria-roledescription={DRAGGABLE_ROLE_DESCRIPTION}
      type="text"
      block
      aria-pressed={selected}
      disabled={!canUpdate || board.busy}
      onClick={() => board.setPicked(selected ? null : match)}
      style={{
        height: 'auto',
        textAlign: 'start',
        whiteSpace: 'normal',
        cursor: canUpdate ? 'grab' : undefined,
        opacity: drag.isDragging ? token.opacityLoading : undefined,
        background: selected ? token.colorPrimaryBg : undefined,
        borderColor: selected ? token.colorPrimary : undefined,
      }}
      {...drag.listeners}
    >
      <Flex vertical style={{ minWidth: 0, width: '100%' }}>
        <Typography.Text strong>
          #{match.matchNo} · {match.subEventCode} · {roundTitle(match.roundCode)}
          {match.groupCode ? ` · Bảng ${match.groupCode}` : ''}
        </Typography.Text>
        <Typography.Text ellipsis type="secondary">
          {sideName(match.side1)}
        </Typography.Text>
        <Typography.Text ellipsis type="secondary">
          {sideName(match.side2)}
        </Typography.Text>
      </Flex>
    </Button>
  );
}

/** Matches without a slot; filter, search and paging all run on the server. */
export function UnscheduledPanel({ eventId, board, canUpdate }: { eventId: string; board: ScheduleBoard; canUpdate: boolean }) {
  const pageSize = useListPageSize();
  const [subEventId, setSubEventId] = useState<string | undefined>();
  const [roundIds, setRoundIds] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), UNSCHEDULED_SEARCH_DEBOUNCE_MS);

  const subEvents = useQuery({
    queryKey: subEventsKey(eventId),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${eventId}/sub-events`)).data,
  });
  const rounds = useRoundOptions(eventId, subEventId);
  const matches = useQuery({
    queryKey: [...scheduleKey(eventId), 'unscheduled', page, pageSize, q, subEventId, roundIds],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), sort: 'matchNo:asc', 'filter[unscheduled]': 'true', 'filter[status]': 'SCHEDULED' });
      if (pageSize) params.set('pageSize', String(pageSize));
      if (q) params.set('q', q);
      if (subEventId) params.set('filter[subEventId]', subEventId);
      if (roundIds) params.set('filter[roundId]', roundIds);
      return apiFetch<{ data: ScheduleMatch[]; total: number; pageSize: number }>(`/admin/events/${eventId}/matches?${params}`);
    },
  });

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const rows = matches.data?.data ?? [];
  const filtered = Boolean(q || subEventId || roundIds);

  return (
    <Card
      size="small"
      title="Trận chưa xếp"
      extra={matches.data ? matches.data.total : undefined}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, minHeight: 0, overflowY: 'auto' } }}
    >
      <Flex vertical gap="small">
        <Select
          aria-label="Nội dung"
          allowClear
          placeholder="Tất cả nội dung"
          value={subEventId}
          options={(subEvents.data ?? []).map((row) => ({ value: row.id, label: subEventTitle(row) }))}
          onChange={(value) => {
            setSubEventId(value);
            setRoundIds(undefined);
            setPage(1);
          }}
        />
        <Select
          aria-label="Vòng"
          allowClear
          placeholder="Tất cả vòng"
          disabled={!subEventId}
          loading={rounds.isFetching}
          value={roundIds}
          options={rounds.data ?? []}
          onChange={reset(setRoundIds)}
        />
        <Input.Search allowClear placeholder="Tên VĐV hoặc số trận" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        {matches.isError && (
          <Alert type="warning" showIcon message="Không tải được danh sách trận." action={<Button size="small" onClick={() => matches.refetch()}>Thử lại</Button>} />
        )}
        {matches.isLoading ? (
          <Skeleton active />
        ) : rows.length === 0 && !matches.isError ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có trận nào' : 'Đã xếp hết trận'} />
        ) : (
          rows.map((match) => <UnscheduledItem key={match.id} match={match} board={board} canUpdate={canUpdate} />)
        )}
        {(matches.data?.total ?? 0) > 0 && (
          <Pagination size="small" simple current={page} pageSize={matches.data?.pageSize ?? 1} total={matches.data?.total ?? 0} showSizeChanger={false} onChange={setPage} />
        )}
      </Flex>
    </Card>
  );
}
