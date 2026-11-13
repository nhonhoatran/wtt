import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Empty, Flex, Input, Result, Select, Skeleton, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useListPageSize } from '../../providers/use-list-page-size';
import { roundTitle } from '../event-hub/draw-labels';
import { subEventsKey, subEventTitle, type SubEventRecord } from '../event-hub/sub-event-labels';
import { MatchScoreDrawer } from './match-score-drawer';
import {
  firstOpenMatch, isOpenMatch, matchScoreText, matchesKey, MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName, STATUS_FILTER_OPTIONS,
  type MatchListItem, type MatchStatusFilter,
} from './match-types';
import { useResultsEvent } from './use-results-event';

const SEARCH_DEBOUNCE_MS = 300;
const FALLBACK_PAGE_SIZE = 20;

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

export function ResultsEntryPage() {
  const { events, list: eventList, selected, select } = useResultsEvent();
  const pageSize = useListPageSize() ?? FALLBACK_PAGE_SIZE;
  const [status, setStatus] = useState<MatchStatusFilter>('OPEN');
  const [subEventId, setSubEventId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(search.trim());
  const eventId = selected?.id;

  const subEvents = useQuery({
    queryKey: subEventsKey(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${eventId}/sub-events`)).data,
  });
  const matches = useQuery({
    queryKey: [...matchesKey(eventId), page, pageSize, q, status, subEventId],
    enabled: Boolean(eventId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: 'matchNo', 'filter[status]': status });
      if (q) params.set('q', q);
      if (subEventId) params.set('filter[subEventId]', subEventId);
      return apiFetch<{ data: MatchListItem[]; total: number }>(`/admin/events/${eventId}/matches?${params}`);
    },
  });

  const rows = matches.data?.data;
  const nextId = firstOpenMatch(rows)?.id;
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const openNext = async () => {
    const fresh = await matches.refetch();
    setOpenId(firstOpenMatch(fresh.data?.data)?.id ?? null);
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
          options={eventList.map((event) => ({ value: event.id, label: event.name }))}
          onChange={(id) => {
            select(id);
            setSubEventId(undefined);
            setPage(1);
          }}
          style={{ minWidth: 260 }}
          showSearch
          optionFilterProp="label"
        />
        <Select
          aria-label="Nội dung"
          allowClear
          placeholder="Tất cả nội dung"
          value={subEventId}
          options={(subEvents.data ?? []).map((row) => ({ value: row.id, label: subEventTitle(row) }))}
          onChange={resetPage(setSubEventId)}
          style={{ minWidth: 200 }}
        />
        <Select aria-label="Trạng thái" value={status} options={STATUS_FILTER_OPTIONS} onChange={resetPage(setStatus)} style={{ width: 150 }} />
        <Input.Search
          allowClear
          placeholder="Tên VĐV hoặc số trận"
          value={search}
          onChange={(event) => resetPage(setSearch)(event.target.value)}
          style={{ width: 260 }}
        />
      </Flex>
      <Table<MatchListItem>
        rowKey="id"
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
        columns={[
          { title: '#', dataIndex: 'matchNo', width: 64 },
          { title: 'Nội dung', render: (_, row) => row.subEventName ?? row.subEventCode },
          { title: 'Vòng', render: (_, row) => `${roundTitle(row.roundCode)}${row.groupCode ? ` · Bảng ${row.groupCode}` : ''}` },
          { title: 'Bên 1', render: (_, row) => sideName(row.side1) },
          { title: 'Bên 2', render: (_, row) => sideName(row.side2) },
          {
            title: 'Trạng thái',
            render: (_, row) => (
              <>
                <Tag color={MATCH_STATUS_COLORS[row.status]}>{MATCH_STATUS_LABELS[row.status]}</Tag>
                {row.id === nextId && isOpenMatch(row) && <Tag color="gold">Trận kế tiếp</Tag>}
              </>
            ),
          },
          { title: 'Tỷ số', render: (_, row) => matchScoreText(row) },
        ]}
      />
      <MatchScoreDrawer
        matchId={openId}
        onClose={() => setOpenId(null)}
        onStarted={() => void matches.refetch()}
        onConfirmed={() => void openNext()}
        onReload={() => void matches.refetch()}
      />
    </Flex>
  );
}
