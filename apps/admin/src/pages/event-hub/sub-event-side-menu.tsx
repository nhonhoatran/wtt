import { Badge, Flex, Menu, Typography, theme } from 'antd';
import type { EntryCount, EntrySubEvent } from './entry-labels';
import { subEventTitle } from './sub-event-labels';

/** Large events can have hundreds of entries per sub-event; show the real number, not "99+". */
const BADGE_OVERFLOW = 9999;

interface SubEventSideMenuProps {
  subEvents: EntrySubEvent[];
  counts: EntryCount[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SubEventSideMenu({ subEvents, counts, selectedId, onSelect }: SubEventSideMenuProps) {
  const { token } = theme.useToken();
  const confirmedOf = (id: string) => counts.find((count) => count.subEventId === id)?.confirmed ?? 0;

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
          title: subEventTitle(subEvent),
          label: (
            <Flex justify="space-between" align="center" gap="small">
              <Typography.Text ellipsis>{subEventTitle(subEvent)}</Typography.Text>
              <Badge
                showZero
                overflowCount={BADGE_OVERFLOW}
                count={subEvent.maxEntries !== null ? `${confirmed}/${subEvent.maxEntries}` : confirmed}
                color={full ? token.colorWarning : token.colorPrimary}
                title={full ? 'Đã đủ số lượng tối đa' : 'Số đăng ký đang tham gia'}
              />
            </Flex>
          ),
        };
      })}
    />
  );
}
