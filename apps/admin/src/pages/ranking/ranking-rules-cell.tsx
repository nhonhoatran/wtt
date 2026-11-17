import { InputNumber, theme } from 'antd';
import { useState } from 'react';

interface RuleCellProps {
  value: number | null;
  edited: boolean;
  disabled: boolean;
  label: string;
  onChange: (points: number | null) => void;
}

/** Clearing the box is only resolved on blur (back to the stored value), so typing a new number is not interrupted. */
export function RankingRuleCell({ value, edited, disabled, label, onChange }: RuleCellProps) {
  const { token } = theme.useToken();
  const [clearing, setClearing] = useState(false);
  return (
    <InputNumber
      min={0}
      precision={0}
      variant="borderless"
      placeholder="—"
      disabled={disabled}
      controls={!disabled}
      value={clearing ? null : value}
      onChange={(next) => {
        setClearing(next === null);
        if (next !== null) onChange(next);
      }}
      onBlur={() => {
        if (clearing) {
          setClearing(false);
          onChange(null);
        }
      }}
      aria-label={label}
      style={{ width: '100%', background: edited ? token.colorWarningBg : undefined }}
    />
  );
}
