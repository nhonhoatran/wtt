import { Flex, Typography, theme } from 'antd';
import type { MatchListItem } from '../results/match-types';
import { scheduleDisciplineColor, scheduleDisciplineLegend } from './schedule-discipline-colors';

export function ScheduleDisciplineLegend({ matches }: { matches: readonly Pick<MatchListItem, 'discipline'>[] }) {
  const { token } = theme.useToken();
  const disciplines = scheduleDisciplineLegend(matches);
  if (!disciplines.length) return null;
  return (
    <Flex wrap gap="small" role="list" aria-label="Màu nội dung trong buổi">
      {disciplines.map((discipline) => (
        <Flex key={discipline.id} align="center" gap={token.marginXXS} role="listitem" style={{ minWidth: 0, maxWidth: '100%' }}>
          <span aria-hidden style={{ width: token.sizeSM, height: token.sizeSM, flexShrink: 0, borderRadius: token.borderRadiusXS, border: `${token.lineWidth}px solid ${token.colorBorder}`, background: scheduleDisciplineColor(discipline.colorHex) ?? token.colorBorderSecondary }} />
          <Typography.Text style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{discipline.code} · {discipline.name}</Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
}
