import { Flex, Typography } from 'antd';
import { RESULT_TYPE_LABELS, type MatchDetail } from './match-types';

export function MatchOfficialResult({ detail, names }: { detail: MatchDetail; names: Record<1 | 2, string> }) {
  return (
    <Flex vertical gap="small">
      {detail.winnerSide && (
        <Typography.Text strong>
          {`Người thắng: ${names[detail.winnerSide]} (${detail.games1}–${detail.games2})`}
          {detail.resultType && detail.resultType !== 'NORMAL' ? ` · ${RESULT_TYPE_LABELS[detail.resultType]}` : ''}
        </Typography.Text>
      )}
      {detail.games.map((game) => (
        <Typography.Text key={game.number}>{`Ván ${game.number}: ${game.score1}–${game.score2}`}</Typography.Text>
      ))}
    </Flex>
  );
}
