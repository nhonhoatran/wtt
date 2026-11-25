import { BarChartOutlined, EditOutlined, InboxOutlined, PlusCircleOutlined } from '@ant-design/icons';
import type { PermissionKey } from '@kamito/shared';
import { Card, Flex, Typography, theme } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface QuickAction {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: ReactNode;
  permission: PermissionKey;
}

/** Only actions that need no tournament picked first; per-tournament shortcuts live on each live tournament card. */
const ACTIONS: QuickAction[] = [
  { key: 'create-event', label: 'Thêm giải đấu', hint: 'Khởi tạo giải mới', path: '/events/create', icon: <PlusCircleOutlined />, permission: 'tournaments.create' },
  { key: 'results', label: 'Nhập kết quả', hint: 'Cập nhật tỷ số', path: '/results', icon: <EditOutlined />, permission: 'matches.list' },
  { key: 'imports', label: 'Lịch sử import', hint: 'Các lần nhập Excel', path: '/imports', icon: <InboxOutlined />, permission: 'tournaments.list' },
  { key: 'rankings', label: 'Bảng xếp hạng', hint: 'Xem và cập nhật điểm', path: '/rankings', icon: <BarChartOutlined />, permission: 'rankings.list' },
];

export function QuickActionsCard({ permissions }: { permissions: readonly PermissionKey[] }) {
  const { token } = theme.useToken();
  const allowed = ACTIONS.filter((action) => permissions.includes(action.permission));
  if (allowed.length === 0) return null;
  return (
    <Card title="Thao tác nhanh">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: token.marginSM }}>
        {allowed.map((action) => (
          <Link key={action.key} to={action.path} style={{ color: 'inherit' }}>
            <Flex vertical gap={token.marginXXS} style={{ height: '100%', padding: token.paddingSM, border: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}>
              <span style={{ fontSize: token.fontSizeXL, color: token.colorPrimary }}>{action.icon}</span>
              <Typography.Text strong>{action.label}</Typography.Text>
              <Typography.Text type="secondary">{action.hint}</Typography.Text>
            </Flex>
          </Link>
        ))}
      </div>
    </Card>
  );
}
