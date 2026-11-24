import { Badge, Flex, Menu, Typography, theme } from 'antd';
import type { ReactNode } from 'react';
import type { EntryCount, EntrySubEvent } from './entry-labels';
import { subEventTitle } from './sub-event-labels';

/** Large events can have hundreds of entries per sub-event; show the real number, not "99+". */
const BADGE_OVERFLOW = 9999;

interface SubEventSideMenuProps {
  subEvents: EntrySubEvent[];
  /** Entry-count badge per item; omit it (e.g. on the draws tab) to show `renderStatus` instead. */
  counts?: EntryCount[];
  /** Optional slot at the right of each item, used by the draws tab for the draw status. */
  renderStatus?: (subEventId: string) => ReactNode;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SubEventSideMenu({ subEvents, counts, selectedId, onSelect, renderStatus }: SubEventSideMenuProps) {
  const { token } = theme.useToken();
  const confirmedOf = (id: string) => counts?.find((count) => count.subEventId === id)?.confirmed ?? 0;

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedId]}
      onClick={({ key }) => onSelect(key)}
      style={{ borderInlineEnd: 'none' }}
      items={subEvents.map((subEvent) => {
        const confirmed = confirmedOf(subEvent.id);
        const full = subEvent.maxEntries !== null && confirmed >= subEvent.maxEntries;
        return {
          key: subEvent.id,
          title: `${subEvent.code} · ${subEventTitle(subEvent)}`,
          label: (
            <Flex justify="space-between" align="center" gap="small">
              {/* The code tells apart sub-events that share a name. */}
              <Typography.Text ellipsis>
                <Typography.Text type="secondary">{subEvent.code}</Typography.Text> {subEventTitle(subEvent)}
              </Typography.Text>
              {counts && (
                <Badge
                  showZero
                  overflowCount={BADGE_OVERFLOW}
                  count={subEvent.maxEntries !== null ? `${confirmed}/${subEvent.maxEntries}` : confirmed}
                  color={full ? token.colorWarning : token.colorPrimary}
                  title={full ? 'Đã đủ số lượng tối đa' : 'Số đăng ký đang tham gia'}
                />
              )}
              {renderStatus?.(subEvent.id)}
            </Flex>
          ),
        };
      })}
    />
  );
}
