import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Tag, Typography, theme } from 'antd';

/** Positive movement = climbed. Null means the player was not in the previous published list. */
export function SnapshotMovementCell({ movement }: { movement: number | null }) {
  const { token } = theme.useToken();
  if (movement === null) return <Tag color="blue">Mới</Tag>;
  if (movement > 0) return <Typography.Text style={{ color: token.colorSuccess }}><ArrowUpOutlined /> +{movement}</Typography.Text>;
  if (movement < 0) return <Typography.Text style={{ color: token.colorError }}><ArrowDownOutlined /> −{Math.abs(movement)}</Typography.Text>;
  return <>—</>;
}
