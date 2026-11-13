import { Button, Typography, theme } from 'antd';
import type { BracketCell } from './bracket-layout';

interface BracketCellButtonProps {
  cell: BracketCell;
  selected: boolean;
  /** Null when the cell cannot be picked (BYE, waiting slot, already played, nothing to do). */
  onPick: (() => void) | null;
}

/** One side of a match. A pickable cell is a real button; the rest is plain secondary text. */
export function BracketCellButton({ cell, selected, onPick }: BracketCellButtonProps) {
  const { token } = theme.useToken();
  const text = cell.seed !== null ? `[${cell.seed}] ${cell.label}` : cell.label;

  if (!onPick) {
    return (
      <Typography.Text type={cell.isEntry ? undefined : 'secondary'} ellipsis style={{ display: 'block', padding: `${token.paddingXXS}px ${token.paddingXS}px` }}>
        {text}
      </Typography.Text>
    );
  }
  return (
    <Button
      type="text"
      block
      size="small"
      aria-pressed={selected}
      onClick={onPick}
      style={{
        textAlign: 'start',
        background: selected ? token.colorPrimaryBg : undefined,
        borderColor: selected ? token.colorPrimary : undefined,
        color: cell.isEntry ? undefined : token.colorTextSecondary,
      }}
    >
      <Typography.Text ellipsis style={{ color: 'inherit' }}>
        {text}
      </Typography.Text>
    </Button>
  );
}
