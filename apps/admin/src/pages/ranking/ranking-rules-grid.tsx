import { Flex, Table, Typography } from 'antd';
import { RankingRuleCell } from './ranking-rules-cell';
import { visibleEventTypes, type RuleEventType, type RulesMatrix } from './use-ranking-rules-matrix';
import { stageLabelWithCode } from './ranking-stage-labels';

const STAGE_COLUMN_WIDTH = 200;
const RULE_COLUMN_WIDTH = 140;

interface RankingRulesGridProps {
  matrix: RulesMatrix;
  readOnly: boolean;
  valueOf: (eventTypeId: string, stageCode: string) => number | null;
  isEdited: (eventTypeId: string, stageCode: string) => boolean;
  onChange: (eventTypeId: string, stageCode: string, points: number | null) => void;
}

const columnTitle = (eventType: RuleEventType) => (
  <Flex vertical>
    <span>{eventType.isActive ? eventType.name : `${eventType.name} (đã ẩn)`}</span>
    {eventType.tier && <Typography.Text type="secondary">{eventType.tier.name}</Typography.Text>}
  </Flex>
);

/** Rows are stages, columns are event types; a blank cell means no rule yet. */
export function RankingRulesGrid({ matrix, readOnly, valueOf, isEdited, onChange }: RankingRulesGridProps) {
  return (
    <Table<{ stageCode: string }>
      size="small"
      bordered
      pagination={false}
      rowKey="stageCode"
      scroll={{ x: 'max-content' }}
      dataSource={matrix.stageCodes.map((stageCode) => ({ stageCode }))}
      columns={[
        { title: 'Vòng', dataIndex: 'stageCode', width: STAGE_COLUMN_WIDTH, fixed: 'left', render: stageLabelWithCode },
        ...visibleEventTypes(matrix).map((eventType) => ({
            key: eventType.id,
            title: columnTitle(eventType),
            width: RULE_COLUMN_WIDTH,
            render: (_: unknown, row: { stageCode: string }) => (
              <RankingRuleCell
                value={valueOf(eventType.id, row.stageCode)}
                edited={isEdited(eventType.id, row.stageCode)}
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
