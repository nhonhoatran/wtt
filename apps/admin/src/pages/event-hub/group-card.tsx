import { Alert, App, Button, Card, Flex, Table, Tag, theme, Typography } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { GroupMemberList, type MemberSwapControl } from './group-member-list';
import { GroupSchedule } from './group-schedule';
import type { EntryBrief, GroupRecord, GroupStanding } from './draw-types';
import type { DrawCall } from './use-draw-call';

interface GroupCardProps {
  group: GroupRecord;
  canUpdate: boolean;
  canWithdraw: boolean;
  /** Draft preview shows the member list; a published group shows the standings table. */
  draft: boolean;
  /** Entry ids sharing a club with another member of this group. */
  flaggedIds: ReadonlySet<string>;
  swap?: MemberSwapControl;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
  onTiebreak: (group: GroupRecord) => void;
  onWithdraw: (entry: EntryBrief) => void;
}

export function GroupCard({ group, canUpdate, canWithdraw, draft, flaggedIds, swap, call, report, onChanged, onTiebreak, onWithdraw }: GroupCardProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [recomputing, setRecomputing] = useState(false);
  const entries = new Map(group.members.map((member) => [member.entryId, member.entry]));
  const standings = [...group.standings].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  const needsTiebreak = standings.some((row) => row.needsManualTiebreak);
  const flagged = flaggedIds.size > 0;

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

  const extra = draft ? (
    <Typography.Text type="secondary">{group.members.length} VĐV</Typography.Text>
  ) : (
    canUpdate && (
      <Button size="small" loading={recomputing} onClick={recompute}>
        Tính lại BXH
      </Button>
    )
  );

  return (
    <Card
      size="small"
      title={
        <Flex gap="small" align="center" wrap>
          {`Bảng ${group.code}`}
          {flagged && <Tag color="warning">Trùng CLB</Tag>}
        </Flex>
      }
      style={flagged ? { borderColor: token.colorWarning } : undefined}
      extra={extra}
    >
      {draft ? (
        <GroupMemberList group={group} flaggedIds={flaggedIds} swap={swap} />
      ) : (
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
          <Table<GroupStanding> dataSource={standings} rowKey="entryId" size="small" pagination={false} scroll={{ x: 'max-content' }}>
            <Table.Column<GroupStanding> title="Hạng" width={56} render={(_, row) => row.rank ?? '—'} />
            <Table.Column<GroupStanding>
              title="VĐV"
              render={(_, row) => (
                <>
                  {entries.get(row.entryId)?.displayName ?? '—'} {row.qualified && <Tag color="green">Đi tiếp</Tag>}
                </>
              )}
            />
            <Table.Column<GroupStanding> title="Trận" align="right" dataIndex="played" />
            <Table.Column<GroupStanding> title="Thắng-Thua" align="right" render={(_, row) => `${row.won}-${row.lost}`} />
            <Table.Column<GroupStanding> title="Ván" align="right" render={(_, row) => `${row.gamesFor}-${row.gamesAgainst}`} />
            <Table.Column<GroupStanding> title="Điểm" align="right" dataIndex="matchPoints" />
            {canWithdraw && (
              <Table.Column<GroupStanding>
                title="Thao tác"
                render={(_, row) => {
                  const entry = entries.get(row.entryId);
                  return entry && entry.status !== 'WITHDRAWN' ? (
                    <Button size="small" danger aria-label={`Rút ${entry.displayName} khỏi bảng ${group.code}`} onClick={() => onWithdraw(entry)}>
                      Rút khỏi bảng
                    </Button>
                  ) : null;
                }}
              />
            )}
          </Table>
          <GroupSchedule group={group} />
        </Flex>
      )}
    </Card>
  );
}
