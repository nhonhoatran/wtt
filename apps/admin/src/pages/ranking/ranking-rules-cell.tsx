import { Flex, InputNumber, theme, Typography } from 'antd';
import { useId, useState } from 'react';
import styles from './ranking-rules-cell.module.css';

export const RULE_POINTS_ERROR = 'Nhập số điểm nguyên, từ 0 trở lên';

interface RuleCellProps {
  value: number | null;
  original: number | null;
  edited: boolean;
  invalid: boolean;
  disabled: boolean;
  label: string;
  onChange: (points: number | null) => void;
}

/** Clearing the box is only resolved on blur (back to the stored value), so typing a new number is not interrupted. */
export function RankingRuleCell({ value, original, edited, invalid, disabled, label, onChange }: RuleCellProps) {
  const { token } = theme.useToken();
  const [clearing, setClearing] = useState(false);
  const noteId = useId();
  return (
    <Flex vertical align="flex-end" gap={token.marginXXS}>
      <InputNumber
        precision={0}
        status={invalid ? 'error' : undefined}
        placeholder={original === null ? 'Chưa có' : 'Giữ giá trị cũ'}
        disabled={disabled}
        controls={false}
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
        aria-invalid={invalid}
        aria-describedby={invalid || edited ? noteId : undefined}
        style={{ width: '100%', background: edited && !invalid ? token.colorWarningBg : undefined }}
        className={styles.points}
      />
      {invalid && <Typography.Text id={noteId} type="danger" style={{ fontSize: token.fontSizeSM }}>{RULE_POINTS_ERROR}</Typography.Text>}
      {edited && !invalid && (
        <Typography.Text id={noteId} type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {original === null ? 'trước: chưa có' : `trước: ${original}`}
        </Typography.Text>
      )}
    </Flex>
  );
}
