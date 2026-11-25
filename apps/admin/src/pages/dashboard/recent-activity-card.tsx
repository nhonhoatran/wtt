import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Flex, List, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { AUDIT_ACTION_LABELS } from '../../resources/audit-logs/audit-log-labels';
import { recentActivityKey, type RecentActivityRow } from './dashboard-types';

const actorText = (row: RecentActivityRow) => (row.actorType === 'SYSTEM' ? 'Hệ thống' : (row.actorName ?? 'Người dùng đã xóa'));

/** Rendered only for roles that may list audit logs; the API enforces the same permission. */
export function RecentActivityCard({ limit }: { limit: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: recentActivityKey(limit),
    queryFn: async () => (await apiFetch<{ data: RecentActivityRow[] }>(`/admin/audit-logs?page=1&pageSize=${limit}&sort=createdAt:desc`)).data,
    refetchOnWindowFocus: true,
  });
  return (
    <Card title="Hoạt động gần đây" extra={<Link to="/audit-logs">Xem tất cả</Link>}>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : isError ? (
        <Typography.Text type="secondary">Không tải được hoạt động gần đây.</Typography.Text>
      ) : !data || data.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động nào" />
      ) : (
        <List
          size="small"
          dataSource={data}
          renderItem={(row) => (
            <List.Item style={{ paddingInline: 0 }}>
              <Flex vertical>
                <Typography.Text>{actorText(row)} · {AUDIT_ACTION_LABELS[row.action] ?? row.action}</Typography.Text>
                <Typography.Text type="secondary">{dayjs(row.createdAt).format('HH:mm DD/MM/YYYY')}</Typography.Text>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
