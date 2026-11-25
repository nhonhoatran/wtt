import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Flex, Tag, Typography, theme } from 'antd';

interface SnapshotMovementCellProps {
  /** Positive = climbed. Null = the player was not in the previous published list. */
  movement: number | null;
  /** Adds a "kỳ trước: hạng x" line. */
  previousRank?: number | null;
  /** False when there is no previous period at all: "Mới" would then be true of everyone. */
  comparable?: boolean;
}

export function SnapshotMovementCell({ movement, previousRank, comparable = true }: SnapshotMovementCellProps) {
  const { token } = theme.useToken();
  if (!comparable) return <>—</>;
  const sign = (
    <>
      {movement === null && <Tag color="blue" style={{ margin: 0 }}>Mới</Tag>}
      {movement !== null && movement > 0 && <Typography.Text style={{ color: token.colorSuccess }}><ArrowUpOutlined /> +{movement}</Typography.Text>}
      {movement !== null && movement < 0 && <Typography.Text style={{ color: token.colorError }}><ArrowDownOutlined /> −{Math.abs(movement)}</Typography.Text>}
      {movement === 0 && '—'}
    </>
  );
  if (previousRank === undefined) return sign;
  return (
    <Flex vertical>
      <span>{sign}</span>
      {previousRank !== null && <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>kỳ trước: hạng {previousRank}</Typography.Text>}
    </Flex>
  );
}
