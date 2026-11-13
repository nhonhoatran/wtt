import { Flex, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BracketCellButton } from './bracket-cell';
import { buildBracketLayout, type BracketCell, type MatchNode } from './bracket-layout';
import { roundTitle } from './draw-labels';
import type { BracketData, EntryBrief } from './draw-types';
import { RoundFormatSelect } from './round-format-select';
import type { DrawCall } from './use-draw-call';

const BRACKET_COLUMN_WIDTH = 220;
const BRACKET_MATCH_NUMBER_WIDTH = 40;

export interface CellActionTarget {
  positionId: string;
  entry: EntryBrief;
}

interface AdminBracketViewProps {
  data: BracketData;
  canUpdate: boolean;
  /** Draft only: swap two first-round positions; resolves when the API answered. */
  onSwap: (positionA: string, positionB: string) => Promise<void>;
  /** Published only: opens the replace / withdraw dialog for a cell. */
  onEntryAction: (target: CellActionTarget) => void;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
}

export function AdminBracketView({ data, canUpdate, onSwap, onEntryAction, call, report, onChanged }: AdminBracketViewProps) {
  const { token } = theme.useToken();
  const layout = useMemo(() => buildBracketLayout(data), [data]);
  const [picked, setPicked] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const draft = data.status === 'DRAFT';

  useEffect(() => {
    if (!picked) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPicked(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked]);

  const click = async (cell: BracketCell) => {
    if (!cell.positionId) return;
    if (!draft) {
      if (cell.entry) onEntryAction({ positionId: cell.positionId, entry: cell.entry });
      return;
    }
    if (!picked) return setPicked(cell.positionId);
    if (picked === cell.positionId) return setPicked(null);
    setSwapping(true);
    try {
      await onSwap(picked, cell.positionId);
    } finally {
      setPicked(null);
      setSwapping(false);
    }
  };

  const pickHandler = (cell: BracketCell) => {
    if (!canUpdate || swapping || !cell.positionId) return null;
    if (draft) return () => void click(cell);
    return cell.entry && !cell.played ? () => void click(cell) : null;
  };

  const hint = draft ? (picked ? 'Bấm VĐV thứ hai để đổi chỗ, Esc để bỏ chọn.' : 'Bấm một VĐV rồi bấm VĐV khác để đổi chỗ hai người.') : 'Bấm một VĐV chưa thi đấu để thay hoặc rút khỏi nhánh.';

  const matchBox = ({ match, cells }: MatchNode) => (
    <Flex
      key={match.id}
      vertical
      style={{ border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, padding: token.paddingXXS, width: BRACKET_COLUMN_WIDTH }}
    >
      <Typography.Text type="secondary" style={{ minWidth: BRACKET_MATCH_NUMBER_WIDTH }}>
        #{match.matchNo}
      </Typography.Text>
      {cells.map((cell) => (
        <BracketCellButton key={cell.key} cell={cell} selected={picked !== null && picked === cell.positionId} onPick={pickHandler(cell)} />
      ))}
    </Flex>
  );

  return (
    <Flex vertical gap="small">
      {canUpdate && <Typography.Text type="secondary">{hint}</Typography.Text>}
      {layout.map((section) => (
        <Flex key={section.section} vertical gap="small">
          {layout.length > 1 && <Typography.Text strong>{section.section}</Typography.Text>}
          <div style={{ overflowX: 'auto' }}>
            <Flex gap="middle" align="stretch">
              {section.columns.map((column) => (
                <Flex key={column.round.id} vertical gap="small" justify="space-around" style={{ width: BRACKET_COLUMN_WIDTH, flex: 'none' }}>
                  <Flex vertical gap={token.marginXXS}>
                    <Typography.Text strong>{roundTitle(column.round.code)}</Typography.Text>
                    {canUpdate ? (
                      <RoundFormatSelect round={column.round} drawVersion={data.version} disabled={swapping} call={call} report={report} onChanged={onChanged} />
                    ) : (
                      <Typography.Text type="secondary">{column.round.matchFormat.name}</Typography.Text>
                    )}
                  </Flex>
                  {column.matches.map(matchBox)}
                </Flex>
              ))}
            </Flex>
          </div>
        </Flex>
      ))}
    </Flex>
  );
}
