import { Alert, App, Button, Card, Flex, Table, Tag } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { GroupSchedule } from './group-schedule';
import type { GroupRecord, GroupStanding } from './draw-types';
import type { DrawCall } from './use-draw-call';

const GROUP_CARD_WIDTH = 480;

interface GroupCardProps {
  group: GroupRecord;
  canUpdate: boolean;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
  onTiebreak: (group: GroupRecord) => void;
}

export function GroupCard({ group, canUpdate, call, report, onChanged, onTiebreak }: GroupCardProps) {
  const { message } = App.useApp();
  const [recomputing, setRecomputing] = useState(false);
  const names = new Map(group.members.map((member) => [member.entryId, member.entry.displayName]));
  const standings = [...group.standings].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  const needsTiebreak = standings.some((row) => row.needsManualTiebreak);

  const recompute = async () => {
    setRecomputing(true);
    try {
      await call(() => apiFetch(`/admin/groups/${group.id}/recompute`, { method: 'POST' }));
      message.success(`Đã tính lại BXH bảng ${group.code}`);
      await onChanged();
    } catch (error) {
      report(error);
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <Card
      size="small"
      title={`Bảng ${group.code}`}
      style={{ width: GROUP_CARD_WIDTH, maxWidth: '100%' }}
      extra={
        canUpdate && (
          <Button size="small" loading={recomputing} onClick={recompute}>
            Tính lại BXH
          </Button>
        )
      }
    >
      <Flex vertical gap="small">
      {needsTiebreak && (
        <Alert
          type="warning"
          showIcon
          message="Cần phá hòa thủ công"
          action={
            canUpdate && (
              <Button size="small" type="primary" onClick={() => onTiebreak(group)}>
                Phá hòa
              </Button>
            )
          }
        />
      )}
      <Table<GroupStanding> dataSource={standings} rowKey="entryId" size="small" pagination={false}>
        <Table.Column<GroupStanding> title="Hạng" width={56} render={(_, row) => row.rank ?? '—'} />
        <Table.Column<GroupStanding>
          title="VĐV"
          render={(_, row) => (
            <>
              {names.get(row.entryId) ?? '—'} {row.qualified && <Tag color="green">Đi tiếp</Tag>}
            </>
          )}
        />
        <Table.Column<GroupStanding> title="Trận" align="right" dataIndex="played" />
        <Table.Column<GroupStanding> title="Thắng-Thua" align="right" render={(_, row) => `${row.won}-${row.lost}`} />
        <Table.Column<GroupStanding> title="Ván" align="right" render={(_, row) => `${row.gamesFor}-${row.gamesAgainst}`} />
        <Table.Column<GroupStanding> title="Điểm" align="right" dataIndex="matchPoints" />
      </Table>
      <GroupSchedule group={group} />
      </Flex>
    </Card>
  );
}
