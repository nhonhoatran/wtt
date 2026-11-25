import { EVENT_LIFECYCLE_LABELS } from '@kamito/shared';
import { Tag } from 'antd';
import type { ReactNode } from 'react';
import { PageHeader } from '../../components/page-header';
import { eventTypeColor, formatDateRange, LIFECYCLE_COLORS, PUBLISH_LABELS, type EventRecord } from '../../resources/events/event-labels';
import type { EventProgress } from './event-progress-steps';

interface EventHubHeaderProps {
  event: EventRecord;
  progress: EventProgress | undefined;
  actions: ReactNode;
}

export function EventHubHeader({ event, progress, actions }: EventHubHeaderProps) {
  const subtitle = [
    formatDateRange(event),
    event.venue?.name,
    `${event._count.subEvents} nội dung`,
    progress ? `${progress.entries.confirmed} lượt đăng ký` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PageHeader
      back={{ to: '/events', label: 'Giải đấu' }}
      title={event.name}
      tags={
        <>
          <Tag color={eventTypeColor(event)} style={{ marginInlineEnd: 0 }}>{event.eventType.name}</Tag>
          <Tag color={event.publishStatus === 'PUBLISHED' ? 'green' : undefined} style={{ marginInlineEnd: 0 }}>{PUBLISH_LABELS[event.publishStatus]}</Tag>
          {event.lifecycle !== 'UPCOMING' && (
            <Tag color={LIFECYCLE_COLORS[event.lifecycle]} style={{ marginInlineEnd: 0 }}>{EVENT_LIFECYCLE_LABELS[event.lifecycle]}</Tag>
          )}
        </>
      }
      subtitle={subtitle}
      actions={actions}
    />
  );
}
