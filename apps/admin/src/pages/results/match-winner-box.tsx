import { theme, Typography } from 'antd';

interface MatchWinnerBoxProps {
  winnerName: string | null;
  bestOf: number;
  gamesNeeded: number;
}

export function MatchWinnerBox({ winnerName, bestOf, gamesNeeded }: MatchWinnerBoxProps) {
  const { token } = theme.useToken();
  return (
    <div style={{ padding: '10px 16px', borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }} aria-live="polite">
      <Typography.Text strong>{`Người thắng: ${winnerName ?? 'chưa xác định'}`}</Typography.Text>
      <br />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {winnerName ? 'Bên thắng đủ số ván theo thể thức.' : `Bên nào thắng ${gamesNeeded}/${bestOf} ván hợp lệ trước sẽ là người thắng.`}
      </Typography.Text>
    </div>
  );
}
