import { Table, Tag } from 'antd';
import { RankingRuleCell } from './ranking-rules-cell';
import { visibleEventTypes, type RuleEventType, type RulesMatrix } from './use-ranking-rules-matrix';
import { stageLabel, stageLabelWithCode } from './ranking-stage-labels';

const STAGE_COLUMN_WIDTH = 200;
const RULE_COLUMN_WIDTH = 160;

interface RankingRulesGridProps {
  matrix: RulesMatrix;
  readOnly: boolean;
  colorOf: (eventTypeId: string) => string | undefined;
  valueOf: (eventTypeId: string, stageCode: string) => number | null;
  originalOf: (eventTypeId: string, stageCode: string) => number | null;
  isEdited: (eventTypeId: string, stageCode: string) => boolean;
  isInvalid: (eventTypeId: string, stageCode: string) => boolean;
  onChange: (eventTypeId: string, stageCode: string, points: number | null) => void;
}

/** Rows are stages, columns are event types; a blank cell means no rule yet. */
export function RankingRulesGrid({ matrix, readOnly, colorOf, valueOf, originalOf, isEdited, isInvalid, onChange }: RankingRulesGridProps) {
  // colorHex is a validated #RRGGBB, so the two-digit suffix is an alpha channel for a soft tag.
  const columnTitle = (eventType: RuleEventType) => {
    const hex = colorOf(eventType.id);
    const style = hex ? { color: hex, background: `${hex}1A`, borderColor: `${hex}55` } : undefined;
    return <Tag style={{ marginInlineEnd: 0, ...style }}>{eventType.isActive ? eventType.name : `${eventType.name} (đã ẩn)`}</Tag>;
  };
  return (
    <Table<{ stageCode: string }>
      size="middle"
      pagination={false}
      rowKey="stageCode"
      scroll={{ x: 'max-content' }}
      dataSource={matrix.stageCodes.map((stageCode) => ({ stageCode }))}
      columns={[
        { title: 'Vòng đấu', dataIndex: 'stageCode', width: STAGE_COLUMN_WIDTH, fixed: 'left', render: stageLabel },
        ...visibleEventTypes(matrix).map((eventType) => ({
          key: eventType.id,
          title: columnTitle(eventType),
          width: RULE_COLUMN_WIDTH,
          align: 'right' as const,
          render: (_: unknown, row: { stageCode: string }) => (
            <RankingRuleCell
              value={valueOf(eventType.id, row.stageCode)}
              original={originalOf(eventType.id, row.stageCode)}
              edited={isEdited(eventType.id, row.stageCode)}
              invalid={isInvalid(eventType.id, row.stageCode)}
              disabled={readOnly}
              label={`${stageLabelWithCode(row.stageCode)} – ${eventType.name}`}
              onChange={(points) => onChange(eventType.id, row.stageCode, points)}
            />
          ),
        })),
      ]}
    />
  );
}
