import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { roundTitle } from '../event-hub/draw-labels';
import { timeInZone } from '../event-hub/schedule-types';
import { isOpenMatch, matchScoreText, MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName, type MatchListItem } from './match-types';

const NO_VALUE = '—';
const MATCH_NO_COLUMN_WIDTH = 64;
const TABLE_COLUMN_WIDTH = 80;
const TIME_COLUMN_WIDTH = 80;
const SCORE_COLUMN_WIDTH = 96;

export function resultsColumns(timeZone: string, nextId: string | undefined): ColumnsType<MatchListItem> {
  return [
    { title: '#', dataIndex: 'matchNo', width: MATCH_NO_COLUMN_WIDTH },
    { title: 'Bàn', width: TABLE_COLUMN_WIDTH, render: (_, row) => row.tableName ?? row.tableCode ?? NO_VALUE },
    { title: 'Giờ', width: TIME_COLUMN_WIDTH, render: (_, row) => (row.scheduledAt ? timeInZone(row.scheduledAt, timeZone) : NO_VALUE) },
    { title: 'Nội dung', render: (_, row) => row.subEventName ?? row.subEventCode },
    { title: 'Vòng', render: (_, row) => `${roundTitle(row.roundCode)}${row.groupCode ? ` · Bảng ${row.groupCode}` : ''}` },
    { title: 'Bên 1', render: (_, row) => sideName(row.side1) },
    { title: 'Bên 2', render: (_, row) => sideName(row.side2) },
    {
      title: 'Trạng thái',
      render: (_, row) => (
        <>
          <Tag color={MATCH_STATUS_COLORS[row.status]}>{MATCH_STATUS_LABELS[row.status]}</Tag>
          {row.id === nextId && isOpenMatch(row) && <Tag color="gold">Trận kế tiếp</Tag>}
        </>
      ),
    },
    { title: 'Tỷ số', width: SCORE_COLUMN_WIDTH, render: (_, row) => matchScoreText(row) },
  ];
}
