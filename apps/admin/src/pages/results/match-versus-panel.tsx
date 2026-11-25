import { Flex, theme, Typography } from 'antd';
import { sideName, type EntryBrief } from './match-types';

interface MatchVersusPanelProps {
  side1: EntryBrief | null;
  side2: EntryBrief | null;
  games1: number;
  games2: number;
  /** Whether any valid game exists; otherwise the centre shows dashes. */
  scored: boolean;
}

const clubsOf = (side: EntryBrief | null): string => [...new Set((side?.players ?? []).map((player) => player.club).filter(Boolean))].join(' · ');

function Side({ side, align }: { side: EntryBrief | null; align: 'left' | 'right' }) {
  const clubs = clubsOf(side);
  return (
    <Flex vertical gap={2} style={{ flex: 1, minWidth: 0, textAlign: align }}>
      <Typography.Text strong style={{ overflowWrap: 'anywhere' }}>
        {sideName(side)}
        {side?.seed ? <Typography.Text type="secondary">{` [${side.seed}]`}</Typography.Text> : null}
      </Typography.Text>
      {clubs && (
        <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
          {clubs}
        </Typography.Text>
      )}
    </Flex>
  );
}

export function MatchVersusPanel({ side1, side2, games1, games2, scored }: MatchVersusPanelProps) {
  const { token } = theme.useToken();
  return (
    <Flex align="center" gap="middle" style={{ padding: 16, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}>
      <Side side={side1} align="left" />
      <Flex vertical align="center" style={{ flex: 'none', maxWidth: 120, textAlign: 'center' }}>
        <Typography.Text strong aria-live="polite" style={{ fontSize: 28, lineHeight: 1.2 }}>
          {scored ? `${games1} – ${games2}` : '– –'}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Tự động tính theo các ván hợp lệ
        </Typography.Text>
      </Flex>
      <Side side={side2} align="right" />
    </Flex>
  );
}
