import { useTable } from '@refinedev/antd';
import { Flex, Table, Tabs, Tag, Typography, theme } from 'antd';
import { useState } from 'react';
import { useListPageSize } from '../providers/use-list-page-size';
import {
  PLAYER_ACTION_LABELS,
  ROW_STATUS_COLORS,
  ROW_STATUS_LABELS,
  ROW_STATUS_ORDER,
  type ImportJob,
  type ImportRow,
  type ImportRowPlayer,
  type ImportRowStatus,
} from '../resources/imports/import-labels';
import { ImportRowDecisionSelect } from './import-row-decision-select';

const ALL_TAB = 'ALL';

interface ImportPreviewTableProps {
  job: ImportJob;
  editable: boolean;
  onDecided: () => void;
}

function firstTab(job: ImportJob): string {
  return ROW_STATUS_ORDER.find((status) => (job.countsByStatus?.[status] ?? 0) > 0) ?? ALL_TAB;
}

const statusFilter = (tab: string) => [{ field: 'status', operator: 'eq' as const, value: tab === ALL_TAB ? undefined : tab }];

/** Server-paged rows of one import job, one tab per row status; uncertain players are decided in place. */
export function ImportPreviewTable({ job, editable, onDecided }: ImportPreviewTableProps) {
  const { token } = theme.useToken();
  const pageSize = useListPageSize();
  const [tab, setTab] = useState(() => firstTab(job));
  const { tableProps, setFilters, tableQuery } = useTable<ImportRow>({
    resource: `imports/${job.id}/rows`,
    syncWithLocation: false,
    pagination: { pageSize },
    filters: { initial: statusFilter(tab) },
  });

  const changeTab = (key: string) => {
    setTab(key);
    setFilters(statusFilter(key), 'replace');
  };
  const decided = () => {
    void tableQuery.refetch();
    onDecided();
  };

  const renderPlayer = (row: ImportRow, player: ImportRowPlayer) => {
    const candidates = row.candidates.find((item) => item.slot === player.slot)?.players ?? [];
    const described = [player.code, player.fullName, player.club, player.birthYear].filter(Boolean).join(' · ');
    return (
      <Flex key={player.slot} vertical gap={token.marginXXS}>
        <Typography.Text>{described || '—'}</Typography.Text>
        {player.action === 'NEEDS_CONFIRM' || (row.status === 'NEEDS_CONFIRM' && candidates.length > 0) ? (
          <ImportRowDecisionSelect
            importId={job.id}
            rowNo={row.rowNo}
            slot={player.slot}
            candidates={candidates}
            value={row.decisions?.[String(player.slot)]}
            disabled={!editable}
            onDecided={decided}
          />
        ) : (
          <Typography.Text type="secondary">{PLAYER_ACTION_LABELS[player.action]}</Typography.Text>
        )}
      </Flex>
    );
  };

  const tabs = [...ROW_STATUS_ORDER, ALL_TAB].map((key) => ({
    key,
    label: key === ALL_TAB ? `Tất cả (${job.totalRows ?? 0})` : `${ROW_STATUS_LABELS[key as ImportRowStatus]} (${job.countsByStatus?.[key as ImportRowStatus] ?? 0})`,
  }));

  return (
    <div>
      <Tabs size="small" activeKey={tab} onChange={changeTab} items={tabs} />
      <Table<ImportRow>
        {...tableProps}
        rowKey="rowNo"
        size="small"
        onRow={(row) => ({ style: row.status === 'NEEDS_CONFIRM' ? { background: token.colorWarningBg } : undefined })}
      >
        <Table.Column<ImportRow> dataIndex="rowNo" title="Dòng" width={64} />
        <Table.Column<ImportRow>
          dataIndex="status"
          title="Trạng thái"
          render={(status: ImportRowStatus) => <Tag color={ROW_STATUS_COLORS[status]}>{ROW_STATUS_LABELS[status]}</Tag>}
        />
        <Table.Column<ImportRow> key="subEvent" title="Mã nội dung" render={(_, row) => row.data.subEventCode || '—'} />
        <Table.Column<ImportRow>
          key="players"
          title="VĐV"
          render={(_, row) => <Flex vertical gap={token.marginXS}>{row.data.players.map((player) => renderPlayer(row, player))}</Flex>}
        />
        <Table.Column<ImportRow>
          key="extra"
          title="Vòng / suất / hạt giống"
          render={(_, row) => [row.data.stage, row.data.quotaType, row.data.seed].filter((value) => value !== null && value !== '').join(' · ') || '—'}
        />
        <Table.Column<ImportRow>
          key="messages"
          title="Ghi chú kiểm tra"
          render={(_, row) =>
            row.messages.length ? (
              <Flex vertical>
                {row.messages.map((text) => (
                  <Typography.Text key={text} type={row.status === 'ERROR' ? 'danger' : 'warning'}>
                    {text}
                  </Typography.Text>
                ))}
              </Flex>
            ) : (
              '—'
            )
          }
        />
      </Table>
    </div>
  );
}
