import { Card, Flex, Skeleton, Statistic, theme, Typography } from 'antd';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** Small note or Tag under the value. */
  note?: ReactNode;
  loading?: boolean;
}

export function StatCard({ label, value, icon, note, loading = false }: StatCardProps) {
  const { token } = theme.useToken();
  return (
    <Card size="small">
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      ) : (
        <Flex justify="space-between" align="flex-start" gap={token.margin}>
          <Flex vertical gap={token.marginXXS}>
            <Typography.Text type="secondary">{label}</Typography.Text>
            <Statistic value={typeof value === 'number' ? value : undefined} formatter={typeof value === 'number' ? undefined : () => value} />
            {note}
          </Flex>
          {icon && <Flex align="center" justify="center" style={{ fontSize: token.fontSizeXL, color: token.colorPrimary }}>{icon}</Flex>}
        </Flex>
      )}
    </Card>
  );
}
