import { Table } from 'antd';
import dayjs from 'dayjs';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { stageLabelWithCode } from './ranking-stage-labels';

export interface BreakdownItem {
  ledgerId: string;
  eventName: string | null;
  eventTypeCode: string | null;
  stageCode: string | null;
  points: number;
  earnedAt: string;
  expiresAt: string;
}

const day = (value: string) => dayjs(value.slice(0, 10)).format(DISPLAY_DATE_FORMAT);

/** The ledger entries that make up one player's points in the snapshot. */
export function SnapshotBreakdownTable({ items }: { items: BreakdownItem[] }) {
  return (
    <Table<BreakdownItem> size="small" pagination={false} rowKey="ledgerId" dataSource={items} scroll={{ x: true }}>
      <Table.Column<BreakdownItem>
        key="event"
        title="Giải"
        render={(_, item) => item.eventName ?? (item.stageCode ? '—' : 'Điểm thủ công')}
      />
      <Table.Column<BreakdownItem> dataIndex="stageCode" title="Vòng" render={(code: string | null) => (code ? stageLabelWithCode(code) : '—')} />
      <Table.Column<BreakdownItem> dataIndex="points" title="Điểm" align="right" />
      <Table.Column<BreakdownItem> key="validity" title="Hiệu lực" render={(_, item) => `${day(item.earnedAt)} → ${day(item.expiresAt)}`} />
    </Table>
  );
}
