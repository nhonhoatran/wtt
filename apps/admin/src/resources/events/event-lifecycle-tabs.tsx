import { EVENT_LIFECYCLE_LABELS, EVENT_LIFECYCLES, type EventLifecycle } from '@kamito/shared';
import { Tabs } from 'antd';
import { LIFECYCLE_ALL_LABEL, type LifecycleCounts } from './event-labels';

const ALL = 'ALL';

interface EventLifecycleTabsProps {
  active: EventLifecycle | undefined;
  counts: LifecycleCounts | undefined;
  onChange: (lifecycle: EventLifecycle | undefined) => void;
}

/** Lifecycle tabs are mutually exclusive, so the four counts add up to "Tất cả". */
export function EventLifecycleTabs({ active, counts, onChange }: EventLifecycleTabsProps) {
  const label = (text: string, key: keyof LifecycleCounts) => (counts ? `${text} (${counts[key]})` : text);
  return (
    <Tabs
      activeKey={active ?? ALL}
      onChange={(key) => onChange(key === ALL ? undefined : (key as EventLifecycle))}
      items={[
        { key: ALL, label: label(LIFECYCLE_ALL_LABEL, 'ALL') },
        ...EVENT_LIFECYCLES.map((lifecycle) => ({ key: lifecycle, label: label(EVENT_LIFECYCLE_LABELS[lifecycle], lifecycle) })),
      ]}
    />
  );
}
