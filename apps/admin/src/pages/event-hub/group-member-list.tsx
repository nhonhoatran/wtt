import { Button, Flex, Tag, theme, Typography } from 'antd';
import type { GroupRecord } from './draw-types';

export interface MemberSwapControl {
  pickedId: string | null;
  busy: boolean;
  onPick: (entryId: string) => void;
}

interface GroupMemberListProps {
  group: GroupRecord;
  /** Entry ids sharing a club with another member of this group. */
  flaggedIds: ReadonlySet<string>;
  /** Present only while the draft can be edited. */
  swap?: MemberSwapControl;
}

const clubsOf = (players: { club: string | null }[]) => [...new Set(players.map((player) => player.club?.trim()).filter(Boolean))].join(' · ');

/** Draft preview of a group: seed, name and club per member, in slot order. */
export function GroupMemberList({ group, flaggedIds, swap }: GroupMemberListProps) {
  const { token } = theme.useToken();
  const members = [...group.members].sort((a, b) => a.slot - b.slot);
  return (
    <Flex vertical component="ul" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {members.map(({ entry, entryId }) => {
        const flagged = flaggedIds.has(entryId);
        const isPicked = swap?.pickedId === entryId;
        const picking = swap?.pickedId != null;
        return (
          <li
            key={entryId}
            data-picked={isPicked || undefined}
            style={{
              padding: '6px 8px',
              borderRadius: token.borderRadius,
              background: isPicked ? token.colorPrimaryBg : undefined,
              outline: isPicked ? `2px solid ${token.colorPrimary}` : undefined,
            }}
          >
            <Flex gap="small" align="center" justify="space-between">
              <Flex gap="small" align="baseline" style={{ minWidth: 0 }}>
                {entry.seed !== null && <Typography.Text type="secondary">[{entry.seed}]</Typography.Text>}
                <Flex vertical style={{ minWidth: 0 }}>
                  <Typography.Text strong={entry.seed !== null}>{entry.displayName}</Typography.Text>
                  <Typography.Text type={flagged ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                    {clubsOf(entry.players) || 'Chưa có CLB'}
                    {flagged && (
                      <Tag color="warning" bordered={false} style={{ marginInlineStart: 6 }}>
                        Trùng CLB
                      </Tag>
                    )}
                  </Typography.Text>
                </Flex>
              </Flex>
              {swap && (
                <Button
                  size="small"
                  type="default"
                  data-swap-entry={entryId}
                  disabled={swap.busy}
                  aria-pressed={isPicked}
                  aria-label={isPicked ? `Bỏ chọn ${entry.displayName}` : picking ? `Đổi chỗ với ${entry.displayName}` : `Chọn ${entry.displayName} để đổi chỗ`}
                  onClick={() => swap.onPick(entryId)}
                >
                  {isPicked ? 'Đang chọn' : picking ? 'Đổi với VĐV này' : 'Đổi chỗ'}
                </Button>
              )}
            </Flex>
          </li>
        );
      })}
    </Flex>
  );
}
