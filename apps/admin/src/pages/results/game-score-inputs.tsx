import { Flex, Input, Typography } from 'antd';
import type { DraftAnalysis, GameDraft } from './score-draft';

interface GameScoreInputsProps {
  draft: readonly GameDraft[];
  analysis: DraftAnalysis;
  disabled: boolean;
  side1Name: string;
  side2Name: string;
  onChange: (index: number, patch: Partial<GameDraft>) => void;
  onEnter: () => void;
}

const MAX_SCORE_DIGITS = 3;
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, MAX_SCORE_DIGITS);

export function GameScoreInputs({ draft, analysis, disabled, side1Name, side2Name, onChange, onEnter }: GameScoreInputsProps) {
  return (
    <Flex vertical gap="small">
      <Flex gap="small" style={{ paddingLeft: 64 }}>
        <Typography.Text type="secondary" ellipsis style={{ width: 88 }}>
          {side1Name}
        </Typography.Text>
        <span style={{ width: 16 }} />
        <Typography.Text type="secondary" ellipsis style={{ width: 88 }}>
          {side2Name}
        </Typography.Text>
      </Flex>
      {draft.map((game, index) => {
        const number = index + 1;
        const error = analysis.gameErrors[number];
        const pastDecision = analysis.decidedAt !== null && number > analysis.decidedAt;
        const locked = disabled || (pastDecision && game.a === '' && game.b === '');
        const status = error ? 'error' : undefined;
        return (
          <div key={number} style={{ opacity: pastDecision && !error ? 0.45 : 1 }}>
            <Flex gap="small" align="center">
              <Typography.Text strong style={{ width: 56 }}>{`Ván ${number}`}</Typography.Text>
              <Input
                aria-label={`Ván ${number}: điểm ${side1Name}`}
                inputMode="numeric"
                status={status}
                disabled={locked}
                autoFocus={index === 0}
                value={game.a}
                style={{ width: 88 }}
                onChange={(event) => onChange(index, { a: digitsOnly(event.target.value) })}
                onPressEnter={onEnter}
              />
              <span>–</span>
              <Input
                aria-label={`Ván ${number}: điểm ${side2Name}`}
                inputMode="numeric"
                status={status}
                disabled={locked}
                value={game.b}
                style={{ width: 88 }}
                onChange={(event) => onChange(index, { b: digitsOnly(event.target.value) })}
                onPressEnter={onEnter}
              />
            </Flex>
            {error && (
              <Typography.Text type="danger" role="alert" style={{ marginLeft: 64 }}>
                {error}
              </Typography.Text>
            )}
          </div>
        );
      })}
    </Flex>
  );
}
