import { EVENT_LIFECYCLE_LABELS } from '@kamito/shared';
import { getDefaultSortOrder } from '@refinedev/antd';
import type { CrudSorting } from '@refinedev/core';
import { Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';
import { eventTypeColor, formatDateRange, LIFECYCLE_COLORS, PUBLISH_LABELS, type EventRecord } from './event-labels';

/** Columns of the events list; "Sửa" is shown only to users who may update events. */
export function eventListColumns(sorters: CrudSorting, canUpdate: boolean): ColumnsType<EventRecord> {
  return [
    {
      key: 'name',
      dataIndex: 'name',
      title: 'Tên giải',
      sorter: true,
      defaultSortOrder: getDefaultSortOrder('name', sorters),
      render: (name: string, event) => (
        <div>
          <Link to={`/events/${event.id}`}>{name}</Link>
          {event.entryCount !== undefined && (
            <div>
              <Typography.Text type="secondary">{event.entryCount} lượt đăng ký</Typography.Text>
            </div>
          )}
        </div>
      ),
    },
    { key: 'eventType', title: 'Hạng giải', render: (_, event) => <Tag color={eventTypeColor(event)}>{event.eventType.name}</Tag> },
    {
      key: 'startDate',
      dataIndex: 'startDate',
      title: 'Thời gian',
      sorter: true,
      defaultSortOrder: getDefaultSortOrder('startDate', sorters),
      render: (_, event) => formatDateRange(event),
    },
    {
      key: 'venue',
      title: 'Địa điểm',
      render: (_, event) =>
        event.venue ? (
          <div>
            <div>{event.venue.name}</div>
            {event.venue.city && <Typography.Text type="secondary">{event.venue.city}</Typography.Text>}
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'subEvents', title: 'Nội dung', align: 'right', render: (_, event) => event._count.subEvents },
    {
      key: 'lifecycle',
      title: 'Trạng thái',
      render: (_, event) => (
        <Space size={4} wrap>
          <Tag color={LIFECYCLE_COLORS[event.lifecycle]}>{EVENT_LIFECYCLE_LABELS[event.lifecycle]}</Tag>
          {event.publishStatus === 'DRAFT' && <Tag>{PUBLISH_LABELS.DRAFT}</Tag>}
        </Space>
      ),
    },
    {
      key: 'actions',
      title: 'Thao tác',
      render: (_, event) => (
        <Space size="middle">
          <Link to={`/events/${event.id}`}>Xem</Link>
          {canUpdate && <Link to={`/events/${event.id}/info`}>Sửa</Link>}
        </Space>
      ),
    },
  ];
}
