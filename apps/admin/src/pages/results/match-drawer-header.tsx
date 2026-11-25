import { Flex, Tag, Typography } from 'antd';
import { roundTitle } from '../event-hub/draw-labels';
import { matchInfoLine } from './match-when-text';
import { MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, type MatchDetail } from './match-types';

export function MatchDrawerHeader({ detail, timeZone }: { detail: MatchDetail; timeZone: string }) {
  return (
    <Flex vertical gap={4}>
      <Flex wrap align="center" gap="small">
        <Typography.Title level={4} style={{ margin: 0 }}>{`Trận #${detail.matchNo}`}</Typography.Title>
        <Tag color={MATCH_STATUS_COLORS[detail.status]}>{MATCH_STATUS_LABELS[detail.status]}</Tag>
        <Tag>{detail.subEventName ?? detail.subEventCode}</Tag>
        <Tag>{`${roundTitle(detail.roundCode)}${detail.groupCode ? ` · Bảng ${detail.groupCode}` : ''}`}</Tag>
      </Flex>
      <Typography.Text type="secondary">{matchInfoLine(detail, timeZone)}</Typography.Text>
    </Flex>
  );
}
