import { Segmented, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { SUB_EVENT_QUERY_PARAM } from './entry-labels';
import { subEventTitle, type SubEventRecord } from './sub-event-labels';

type PillSubEvent = Pick<SubEventRecord, 'id' | 'code' | 'name' | 'discipline' | 'category'>;

interface SubEventPillsProps {
  subEvents: PillSubEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Count or status dot shown after each label. */
  renderMeta?: (subEventId: string) => ReactNode;
}

/** Horizontal sub-event picker; scrolls sideways on narrow screens instead of wrapping. */
export function SubEventPills({ subEvents, selectedId, onSelect, renderMeta }: SubEventPillsProps) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <Segmented
        value={selectedId}
        onChange={(value) => onSelect(String(value))}
        options={subEvents.map((subEvent) => ({
          value: subEvent.id,
          title: `${subEvent.code} · ${subEventTitle(subEvent)}`,
          label: (
            <span style={{ whiteSpace: 'nowrap' }}>
              <Typography.Text type="secondary">{subEvent.code}</Typography.Text> {subEventTitle(subEvent)}
              {renderMeta && <> {renderMeta(subEvent.id)}</>}
            </span>
          ),
        }))}
      />
    </div>
  );
}

/** Selected sub-event from ?subEvent=, falling back to the first one; selecting rewrites only that param. */
export function useSubEventParam<T extends { id: string }>(subEvents: T[]): [T | undefined, (id: string) => void] {
  const [params, setParams] = useSearchParams();
  const selected = subEvents.find((row) => row.id === params.get(SUB_EVENT_QUERY_PARAM)) ?? subEvents[0];
  const select = (id: string) =>
    setParams((current) => {
      current.set(SUB_EVENT_QUERY_PARAM, id);
      return current;
    });
  return [selected, select];
}
