import { EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Flex, Result, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { useTableScroll } from '../../components/use-table-scroll';
import { useListPageSize } from '../../providers/use-list-page-size';
import { roundTitle } from '../event-hub/draw-labels';
import { tableDisplayName } from '../event-hub/table-display-name';
import { pendingMatchesKey, type PendingMatchesPage, type PendingMatchRow } from './dashboard-types';
import { matchTimeText, PENDING_STATUS_COLORS, PENDING_STATUS_LABELS, pendingMatchStatus, resultsLink } from './pending-match-status';

const side = (entry: PendingMatchRow['side1']) => entry?.displayName ?? 'Chờ xác định';

export function PendingMatchesTable({ showEvent }: { showEvent: boolean }) {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: pendingMatchesKey(page, pageSize),
    queryFn: () => apiFetch<PendingMatchesPage>(`/admin/dashboard/pending-matches?page=${page}${pageSize ? `&pageSize=${pageSize}` : ''}`),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: true,
  });
  const emptyPage = data !== undefined && data.data.length === 0 && page > 1;
  useEffect(() => {
    if (emptyPage) setPage(1);
  }, [emptyPage]);
  const nowMs = dataUpdatedAt || Date.now();

  return (
    <Card title={<Flex align="center" gap="small">Trận chờ kết quả hôm nay {data && <Tag color="gold">{data.total} trận</Tag>}</Flex>} styles={{ body: { padding: 0 } }}>
      {isError ? (
        <Result status="warning" title="Không tải được danh sách trận" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : (
        <Table<PendingMatchRow>
          rowKey="id"
          size="middle"
          loading={isLoading}
          dataSource={data?.data ?? []}
          scroll={tableScroll}
          locale={{ emptyText: <Empty description={<>Hôm nay chưa có trận nào. Xem <Link to="/events">danh sách giải</Link> để xếp lịch.</>} /> }}
          pagination={{ current: page, pageSize: data?.pageSize ?? pageSize ?? 20, total: data?.total ?? 0, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage }}
          columns={[
            {
              key: 'when',
              title: 'Giờ / Bàn',
              render: (_, row) => (
                <Flex vertical>
                  <Typography.Text strong>{matchTimeText(row.scheduledAt, row.timezone)}</Typography.Text>
                  <Typography.Text type="secondary">{(row.table && tableDisplayName(row.table)) || 'Chưa xếp bàn'}</Typography.Text>
                </Flex>
              ),
            },
            {
              key: 'round',
              title: 'Nội dung · Vòng',
              render: (_: unknown, row: PendingMatchRow) => (
                <Flex vertical>
                  <Typography.Text>{row.subEvent.name} · {roundTitle(row.round.code)}</Typography.Text>
                  {showEvent && <Typography.Text type="secondary">{row.eventName}</Typography.Text>}
                </Flex>
              ),
            },
            {
              key: 'sides',
              title: 'Hai bên thi đấu',
              render: (_, row) => (
                <Flex vertical>
                  <Typography.Text>{side(row.side1)}</Typography.Text>
                  <Typography.Text type="secondary">{side(row.side2)}</Typography.Text>
                </Flex>
              ),
            },
            {
              key: 'status',
              title: 'Trạng thái',
              render: (_, row) => {
                const status = pendingMatchStatus(row, nowMs);
                return <Tag color={PENDING_STATUS_COLORS[status]}>{PENDING_STATUS_LABELS[status]}</Tag>;
              },
            },
            {
              key: 'action',
              title: 'Thao tác',
              render: (_, row) => <Link to={resultsLink(row)}><Button size="small" icon={<EditOutlined />}>Nhập</Button></Link>,
            },
          ]}
        />
      )}
    </Card>
  );
}
