import { getDefaultSortOrder } from '@refinedev/antd';
import type { CrudSorting } from '@refinedev/core';
import { Button, Flex, Space, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { ENTRY_STAGE_LABELS, ENTRY_STATUS_LABELS, QUOTA_LABELS, type EntryRecord, type EntrySubEvent } from './entry-labels';
import { EntrySeedCell } from './entry-seed-cell';

interface EntryColumnsOptions {
  subEvent: EntrySubEvent;
  canUpdate: boolean;
  sorters: CrudSorting;
  registerSeedInput: (entryId: string, element: HTMLInputElement | null) => void;
  moveSeedFocus: (entry: EntryRecord, backwards: boolean) => boolean;
  setStatus: (entry: EntryRecord, status: EntryRecord['status']) => Promise<void>;
  onError: (error: unknown) => void;
}

const dim = (entry: EntryRecord) => (entry.status === 'WITHDRAWN' ? { color: 'inherit' } : undefined);

export function entryColumns({ subEvent, canUpdate, sorters, registerSeedInput, moveSeedFocus, setStatus, onError }: EntryColumnsOptions): ColumnsType<EntryRecord> {
  const columns: ColumnsType<EntryRecord> = [
    {
      key: 'seed',
      dataIndex: 'seed',
      title: 'Hạt giống',
      sorter: true,
      defaultSortOrder: getDefaultSortOrder('seed', sorters),
      render: (seed: number | null, entry) =>
        canUpdate && entry.status === 'CONFIRMED' ? (
          <EntrySeedCell entry={entry} register={(element) => registerSeedInput(entry.id, element)} onTab={(backwards) => moveSeedFocus(entry, backwards)} />
        ) : (
          (seed ?? '—')
        ),
    },
    {
      key: 'displayName',
      dataIndex: ['competitor', 'displayName'],
      title: subEvent.discipline.competitorKind === 'DOUBLES' ? 'Cặp' : 'VĐV',
      sorter: true,
      defaultSortOrder: getDefaultSortOrder('displayName', sorters),
      render: (_, entry) => (
        <Flex vertical>
          {entry.competitor.players.map((player) => (
            <span key={player.id}>
              <Link to={`/players/${player.id}/edit`} style={dim(entry)}>
                {player.fullName}
              </Link>{' '}
              <Typography.Text type="secondary">{[player.code, player.birthYear].filter(Boolean).join(' · ')}</Typography.Text>
            </span>
          ))}
        </Flex>
      ),
    },
    {
      key: 'club',
      title: 'CLB',
      render: (_, entry) => (
        <Flex vertical>
          {entry.competitor.players.map((player) => (
            <span key={player.id}>{player.club ?? '—'}</span>
          ))}
        </Flex>
      ),
    },
    { key: 'points', dataIndex: 'pointsAtEntry', title: 'Điểm xếp hạng', align: 'right', render: (points: number | null) => points ?? '—' },
  ];

  if (subEvent.hasQualifying) {
    columns.push({
      key: 'stage',
      dataIndex: 'stage',
      title: 'Vòng',
      render: (stage: EntryRecord['stage']) => <Tag color={stage === 'QUALIFYING' ? 'purple' : undefined}>{ENTRY_STAGE_LABELS[stage]}</Tag>,
    });
  }

  columns.push(
    {
      key: 'status',
      dataIndex: 'status',
      title: 'Trạng thái',
      render: (status: EntryRecord['status'], entry) => (
        <Space size="small" wrap>
          <Tag color={status === 'CONFIRMED' ? 'green' : undefined}>{ENTRY_STATUS_LABELS[status]}</Tag>
          {entry.quotaType !== 'DIRECT' && <Tag color="blue">{QUOTA_LABELS[entry.quotaType]}</Tag>}
          {entry.eligibilityOverrideReason && (
            <Tooltip title={`Lý do ghi đè: ${entry.eligibilityOverrideReason}`}>
              <Tag color="orange">Ghi đè</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    { key: 'notes', dataIndex: 'notes', title: 'Ghi chú', render: (notes: string | null) => notes ?? '—' },
  );

  if (canUpdate) {
    columns.push({
      key: 'actions',
      title: 'Thao tác',
      render: (_, entry) =>
        entry.status === 'CONFIRMED' ? (
          <ConfirmActionButton
            label="Rút"
            title={`Rút ${entry.competitor.displayName}?`}
            content="Đăng ký vẫn nằm trong danh sách (hiện mờ) và khôi phục được."
            okText="Rút"
            danger
            buttonProps={{ size: 'small' }}
            onConfirm={() => setStatus(entry, 'WITHDRAWN')}
          />
        ) : (
          <Button size="small" onClick={() => void setStatus(entry, 'CONFIRMED').catch(onError)}>
            Khôi phục
          </Button>
        ),
    });
  }
  return columns;
}
