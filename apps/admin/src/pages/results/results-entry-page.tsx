import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Empty, Flex, Input, Result, Select, Skeleton, Table, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../components/use-debounced-value';
import { useListPageSize } from '../../providers/use-list-page-size';
import { sessionDatedLabel } from '../event-hub/schedule-types';
import { subEventsKey, subEventTitle, type SubEventRecord } from '../event-hub/sub-event-labels';
import { MatchScoreDrawer } from './match-score-drawer';
import { firstOpenMatch, matchesKey, STATUS_FILTER_OPTIONS, type MatchListItem } from './match-types';
import { nextOnTable, sortBySlot } from './match-slot-order';
import { resultsColumns } from './results-match-columns';
import { useResultsEvent } from './use-results-event';
import { useResultsScheduleFilter } from './use-results-schedule-filter';
import { useStoredStatusFilter } from './use-stored-status-filter';

const FALLBACK_PAGE_SIZE = 20;
const EVENT_SELECT_MIN_WIDTH = 260;
const SUB_EVENT_SELECT_MIN_WIDTH = 200;
const SESSION_SELECT_MIN_WIDTH = 220;
const TABLE_SELECT_MIN_WIDTH = 140;
const STATUS_SELECT_WIDTH = 150;
const SEARCH_WIDTH = 260;

export function ResultsEntryPage() {
  const events = useResultsEvent();
  const { selected } = events;
  const pageSize = useListPageSize() ?? FALLBACK_PAGE_SIZE;
  const [status, setStatus] = useStoredStatusFilter();
  const [subEventId, setSubEventId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const eventId = selected?.id;
  const schedule = useResultsScheduleFilter(eventId, selected?.lifecycle === 'ONGOING');

  const subEvents = useQuery({
    queryKey: subEventsKey(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${eventId}/sub-events`)).data,
  });
  const matches = useQuery({
    queryKey: [...matchesKey(eventId), page, pageSize, q, status, subEventId, schedule.sessionId, schedule.tableId],
    enabled: Boolean(eventId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: 'matchNo:asc', 'filter[status]': status });
      if (q) params.set('q', q);
      if (subEventId) params.set('filter[subEventId]', subEventId);
      if (schedule.sessionId) params.set('filter[sessionId]', schedule.sessionId);
      if (schedule.tableId) params.set('filter[tableId]', schedule.tableId);
      return apiFetch<{ data: MatchListItem[]; total: number }>(`/admin/events/${eventId}/matches?${params}`);
    },
  });

  const tableOrder = useMemo(
    () => new Map((schedule.sessions.find((row) => row.id === schedule.sessionId)?.tables ?? []).map((table) => [table.tableId, table.order])),
    [schedule.sessions, schedule.sessionId],
  );
  const rows = useMemo(() => {
    const data = matches.data?.data;
    return data && schedule.sessionId ? sortBySlot(data, tableOrder) : data;
  }, [matches.data, schedule.sessionId, tableOrder]);
  const nextId = firstOpenMatch(rows)?.id;
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  // Players stay at the table they just played on, so its next match comes first; the list order is the fallback.
  const openNext = async (finishedTableId: string | null) => {
    const fresh = await matches.refetch();
    let sameTable: MatchListItem | undefined;
    if (finishedTableId && eventId) {
      sameTable = await nextOnTable({ eventId, tableId: finishedTableId, sessionId: schedule.sessionId, pageSize }).catch(() => undefined);
    }
    const freshRows = fresh.data?.data;
    const fallback = firstOpenMatch(freshRows && schedule.sessionId ? sortBySlot(freshRows, tableOrder) : freshRows);
    setOpenId((sameTable ?? fallback)?.id ?? null);
  };

  if (events.isLoading) return <Skeleton active />;
  if (events.isError) return <Result status="error" title="Không tải được danh sách giải" extra={<Button onClick={() => events.refetch()}>Thử lại</Button>} />;
  if (!selected) return <Empty description="Chưa có giải nào" />;

  return (
    <Flex vertical gap="middle">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Nhập tỷ số
      </Typography.Title>
      <Flex wrap gap="small">
        <Select
          aria-label="Giải đấu"
          value={selected.id}
          options={events.options.map((event) => ({ value: event.id, label: event.name }))}
          onChange={(id) => {
            events.select(id);
            setSubEventId(undefined);
            setPage(1);
          }}
          style={{ minWidth: EVENT_SELECT_MIN_WIDTH }}
          showSearch
          filterOption={false}
          onSearch={events.onSearch}
          loading={events.searching}
        />
        <Select
          aria-label="Nội dung"
          allowClear
          placeholder="Tất cả nội dung"
          value={subEventId}
          options={(subEvents.data ?? []).map((row) => ({ value: row.id, label: subEventTitle(row) }))}
          onChange={resetPage(setSubEventId)}
          style={{ minWidth: SUB_EVENT_SELECT_MIN_WIDTH }}
        />
        <Select
          aria-label="Buổi thi đấu"
          allowClear
          placeholder="Tất cả buổi"
          value={schedule.sessionId}
          options={schedule.sessions.map((row) => ({ value: row.id, label: sessionDatedLabel(row) }))}
          onChange={resetPage(schedule.setSession)}
          style={{ minWidth: SESSION_SELECT_MIN_WIDTH }}
        />
        <Select
          aria-label="Bàn"
          allowClear
          placeholder="Tất cả bàn"
          value={schedule.tableId}
          options={schedule.tables}
          onChange={resetPage(schedule.setTable)}
          style={{ minWidth: TABLE_SELECT_MIN_WIDTH }}
        />
        <Select aria-label="Trạng thái" value={status} options={STATUS_FILTER_OPTIONS} onChange={resetPage(setStatus)} style={{ width: STATUS_SELECT_WIDTH }} />
        <Input.Search
          allowClear
          placeholder="Tên VĐV hoặc số trận"
          value={search}
          onChange={(event) => resetPage(setSearch)(event.target.value)}
          style={{ width: SEARCH_WIDTH }}
        />
      </Flex>
      <Table<MatchListItem>
        rowKey="id" scroll={{ x: true }}
        size="middle"
        loading={matches.isFetching}
        dataSource={rows}
        locale={{ emptyText: matches.isError ? 'Không tải được danh sách trận' : 'Không có trận nào' }}
        rowClassName={(row) => (row.id === nextId ? 'ant-table-row-selected' : '')}
        pagination={{ current: page, pageSize, total: matches.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        onRow={(row) => ({
          onClick: () => setOpenId(row.id),
          onKeyDown: (event) => event.key === 'Enter' && setOpenId(row.id),
          tabIndex: 0,
          style: { cursor: 'pointer' },
        })}
        columns={resultsColumns(selected.timezone, nextId)}
      />
      <MatchScoreDrawer
        matchId={openId}
        onClose={() => setOpenId(null)}
        onStarted={() => void matches.refetch()}
        onConfirmed={(tableId) => void openNext(tableId)}
        onReload={() => void matches.refetch()}
      />
    </Flex>
  );
}
