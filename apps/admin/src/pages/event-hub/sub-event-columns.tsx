import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { OVERALL_COLORS, OVERALL_LABELS, overallDrawState, overviewOf } from './draw-labels';
import type { DrawOverviewRow } from './draw-types';
import { SUB_EVENT_QUERY_PARAM, type EntryCount } from './entry-labels';
import {
  entryUnit,
  matchFormatSummary,
  SUB_EVENT_FORMAT_LABELS,
  subEventTitle,
  type SubEventRecord,
} from './sub-event-labels';

interface ColumnOptions {
  eventId: string;
  counts: EntryCount[] | undefined;
  overview: DrawOverviewRow[] | undefined;
  published: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (row: SubEventRecord) => void;
  onRemove: (row: SubEventRecord) => () => Promise<void>;
}

const Secondary = ({ children }: { children: React.ReactNode }) => (
  <div>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {children}
    </Typography.Text>
  </div>
);

const tabLink = (eventId: string, tab: string, subEventId: string) => `/events/${eventId}/${tab}?${SUB_EVENT_QUERY_PARAM}=${subEventId}`;

export function subEventColumns(options: ColumnOptions): ColumnsType<SubEventRecord> {
  const { eventId, counts, overview, published } = options;
  const countOf = (id: string) => counts?.find((row) => row.subEventId === id);

  const columns: ColumnsType<SubEventRecord> = [
    {
      title: 'Nội dung',
      render: (_, row) => {
        const extras = [row.groupScoringRule && `Luật vòng bảng: ${row.groupScoringRule.name}`, row.rankingList && `BXH: ${row.rankingList.name}`].filter(Boolean);
        return (
          <>
            <Space size={6}>
              <Typography.Text strong>{subEventTitle(row)}</Typography.Text>
              <Tag style={{ marginInlineEnd: 0 }}>{row.code}</Tag>
            </Space>
            {extras.length > 0 && <Secondary>{extras.join(' · ')}</Secondary>}
          </>
        );
      },
    },
    {
      title: 'Thể thức',
      render: (_, row) => (
        <>
          {SUB_EVENT_FORMAT_LABELS[row.format]}
          {row.hasQualifying && <Secondary>Có vòng loại</Secondary>}
        </>
      ),
    },
    {
      title: 'Thể thức trận',
      render: (_, row) => (
        <>
          {row.matchFormat.name}
          <Secondary>{matchFormatSummary(row.matchFormat)}</Secondary>
        </>
      ),
    },
    {
      title: 'Số VĐV/cặp',
      align: 'right',
      render: (_, row) => {
        const count = countOf(row.id);
        if (!count) return '—';
        const label = `${count.confirmed}${row.maxEntries != null ? ` / ${row.maxEntries}` : ''}`;
        return (
          <Tooltip title={`Xem danh sách đăng ký (${entryUnit(row.discipline.competitorKind)})`}>
            <Link to={tabLink(eventId, 'entries', row.id)}>{label}</Link>
          </Tooltip>
        );
      },
    },
    { title: 'Hạt giống', align: 'right', render: (_, row) => countOf(row.id)?.seeded ?? '—' },
    {
      title: 'Bốc thăm',
      render: (_, row) => {
        if (!overview) return '—';
        const state = overallDrawState(overviewOf(overview, row.id)?.draws);
        return (
          <Link to={tabLink(eventId, 'draws', row.id)}>
            <Tag color={OVERALL_COLORS[state]} style={{ cursor: 'pointer', marginInlineEnd: 0 }}>
              {OVERALL_LABELS[state]}
            </Tag>
          </Link>
        );
      },
    },
  ];

  if (options.canUpdate || options.canDelete) {
    columns.push({
      title: 'Thao tác',
      render: (_, row) => (
        <Space>
          {options.canUpdate && (
            <Button size="small" onClick={() => options.onEdit(row)}>
              Sửa
            </Button>
          )}
          {options.canDelete && (
            <Tooltip title={published ? 'Bỏ công bố giải trước khi xóa nội dung' : undefined}>
              <span>
                <ConfirmActionButton
                  label="Xóa"
                  title={`Xóa nội dung ${subEventTitle(row)}?`}
                  okText="Xóa"
                  danger
                  buttonProps={{ size: 'small', disabled: published }}
                  onConfirm={options.onRemove(row)}
                />
              </span>
            </Tooltip>
          )}
        </Space>
      ),
    });
  }
  return columns;
}
