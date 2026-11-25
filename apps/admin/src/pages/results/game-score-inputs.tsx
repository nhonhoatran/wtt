import { Flex, Input, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { DraftAnalysis, GameDraft } from './score-draft';

interface GameScoreInputsProps {
  draft: readonly GameDraft[];
  analysis: DraftAnalysis;
  disabled: boolean;
  side1Name: string;
  side2Name: string;
  onChange: (index: number, patch: Partial<GameDraft>) => void;
  /** Enter on the last cell of a game; the form submits when the result is valid. */
  onSubmit: () => void;
}

const MAX_SCORE_DIGITS = 3;
const FOCUS_DELAY_MS = 80;
const LABEL_COLUMN = 'minmax(56px, 1fr)';
const GAME_COLUMN = 'minmax(46px, 72px)';
const WINNER_COLUMN = 'minmax(40px, 64px)';
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, MAX_SCORE_DIGITS);
const centered = { textAlign: 'center', padding: '4px 2px' } as const;

export function GameScoreInputs({ draft, analysis, disabled, side1Name, side2Name, onChange, onSubmit }: GameScoreInputsProps) {
  const root = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState<ReadonlySet<number>>(new Set());
  const names = [side1Name, side2Name];
  const wins = [analysis.outcome.games1, analysis.outcome.games2];
  const shownErrors = draft.map((_, index) => index + 1).filter((number) => touched.has(number) && analysis.gameErrors[number]);

  const focusCell = (index: number, side: number) => root.current?.querySelector<HTMLInputElement>(`[data-cell="${index}-${side}"]:not(:disabled)`)?.focus();
  const touch = (number: number) => setTouched((current) => new Set(current).add(number));
  // The drawer or modal grabs focus while it animates open, so the first cell is focused just after.
  useEffect(() => {
    const timer = setTimeout(() => focusCell(0, 0), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const onEnter = (index: number, side: number) => {
    if (side === 0) return focusCell(index, 1);
    touch(index + 1);
    if (analysis.outcome.valid) return onSubmit();
    focusCell(index + 1, 0);
  };

  return (
    <Flex vertical gap="small">
      <div ref={root} style={{ display: 'grid', gridTemplateColumns: `${LABEL_COLUMN} repeat(${draft.length}, ${GAME_COLUMN}) ${WINNER_COLUMN}`, gap: 6, alignItems: 'center' }}>
        {draft.map((_, index) => (
          <Typography.Text key={`head-${index}`} type="secondary" style={{ gridRow: 1, gridColumn: index + 2, textAlign: 'center', fontSize: 12 }}>{`Ván ${index + 1}`}</Typography.Text>
        ))}
        <Typography.Text type="secondary" style={{ gridRow: 1, gridColumn: draft.length + 2, textAlign: 'center', fontSize: 12 }}>
          Ván thắng
        </Typography.Text>
        {names.map((name, side) => (
          <Typography.Text key={`name-${side}`} strong ellipsis={{ tooltip: name }} style={{ gridRow: side + 2, gridColumn: 1 }}>
            {name}
          </Typography.Text>
        ))}
        {draft.map((game, index) => {
          const number = index + 1;
          const invalid = touched.has(number) && Boolean(analysis.gameErrors[number]);
          const pastDecision = analysis.decidedAt !== null && number > analysis.decidedAt;
          const locked = disabled || (pastDecision && game.a === '' && game.b === '');
          return [0, 1].map((side) => (
            <Input
              key={`${number}-${side}`}
              data-cell={`${index}-${side}`}
              aria-label={`Ván ${number}: điểm ${names[side]}`}
              aria-invalid={invalid}
              inputMode="numeric"
              status={invalid ? 'error' : undefined}
              disabled={locked}
              value={side === 0 ? game.a : game.b}
              style={{ ...centered, gridRow: side + 2, gridColumn: index + 2, opacity: pastDecision && !invalid ? 0.45 : 1 }}
              onChange={(event) => onChange(index, side === 0 ? { a: digitsOnly(event.target.value) } : { b: digitsOnly(event.target.value) })}
              onBlur={() => game.a !== '' && game.b !== '' && touch(number)}
              onFocus={(event) => event.target.select()}
              onPressEnter={() => onEnter(index, side)}
            />
          ));
        })}
        {wins.map((count, side) => (
          <Typography.Text key={`wins-${side}`} strong style={{ gridRow: side + 2, gridColumn: draft.length + 2, textAlign: 'center' }}>
            {analysis.entered.length > 0 ? count : '–'}
          </Typography.Text>
        ))}
      </div>
      {shownErrors.map((number) => (
        <Typography.Text key={number} type="danger" role="alert">
          {analysis.gameErrors[number]}
        </Typography.Text>
      ))}
    </Flex>
  );
}
