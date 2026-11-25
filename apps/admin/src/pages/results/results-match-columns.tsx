import { Flex, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import { roundTitle } from '../event-hub/draw-labels';
import { timeInZone } from '../event-hub/schedule-types';
import { matchTableLabel } from '../event-hub/table-display-name';
import { isOpenMatch, matchScoreText, MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName, type MatchListItem } from './match-types';

const NO_VALUE = '—';
const MATCH_NO_COLUMN_WIDTH = 64;
const TABLE_COLUMN_WIDTH = 80;
const TIME_COLUMN_WIDTH = 80;
const SCORE_COLUMN_WIDTH = 96;
/** Phones get one summary column; the full grid starts at the `sm` breakpoint. */
const PHONE: ['xs'] = ['xs'];
const WIDE: ['sm'] = ['sm'];

const tableOf = (row: MatchListItem) => row.tableName ?? row.tableCode ?? NO_VALUE;
const tableLineOf = (row: MatchListItem) => matchTableLabel(row) ?? NO_VALUE;
const timeOf = (row: MatchListItem, timeZone: string) => (row.scheduledAt ? timeInZone(row.scheduledAt, timeZone) : NO_VALUE);
const roundOf = (row: MatchListItem) => `${roundTitle(row.roundCode)}${row.groupCode ? ` · Bảng ${row.groupCode}` : ''}`;

function statusTags(row: MatchListItem, nextId: string | undefined): ReactNode {
  return (
    <>
      <Tag color={MATCH_STATUS_COLORS[row.status]}>{MATCH_STATUS_LABELS[row.status]}</Tag>
      {row.id === nextId && isOpenMatch(row) && <Tag color="gold">Trận kế tiếp</Tag>}
    </>
  );
}

export function resultsColumns(timeZone: string, nextId: string | undefined): ColumnsType<MatchListItem> {
  return [
    {
      title: 'Trận',
      key: 'summary',
      responsive: PHONE,
      render: (_, row) => (
        <Flex vertical gap={2}>
          <Typography.Text type="secondary">
            #{row.matchNo} · {row.tableId || row.scheduledAt ? `${tableLineOf(row)} · ${timeOf(row, timeZone)}` : 'Chưa xếp lịch'}
          </Typography.Text>
          <Typography.Text>{sideName(row.side1)}</Typography.Text>
          <Typography.Text>{sideName(row.side2)}</Typography.Text>
          <Space size={4} wrap>
            {statusTags(row, nextId)}
            <Typography.Text strong>{matchScoreText(row)}</Typography.Text>
          </Space>
          <Typography.Text type="secondary">
            {row.subEventName ?? row.subEventCode} · {roundOf(row)}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: '#', dataIndex: 'matchNo', width: MATCH_NO_COLUMN_WIDTH, responsive: WIDE },
    { title: 'Bàn', width: TABLE_COLUMN_WIDTH, responsive: WIDE, render: (_, row) => tableOf(row) },
    { title: 'Giờ', width: TIME_COLUMN_WIDTH, responsive: WIDE, render: (_, row) => timeOf(row, timeZone) },
    { title: 'Nội dung', responsive: WIDE, render: (_, row) => row.subEventName ?? row.subEventCode },
    { title: 'Vòng', responsive: WIDE, render: (_, row) => roundOf(row) },
    { title: 'Bên 1', responsive: WIDE, render: (_, row) => sideName(row.side1) },
    { title: 'Bên 2', responsive: WIDE, render: (_, row) => sideName(row.side2) },
    { title: 'Trạng thái', responsive: WIDE, render: (_, row) => statusTags(row, nextId) },
    { title: 'Tỷ số', width: SCORE_COLUMN_WIDTH, responsive: WIDE, render: (_, row) => matchScoreText(row) },
  ];
}
