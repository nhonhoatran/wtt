import { CalendarOutlined, EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Progress, Space, Tag, Typography, theme } from 'antd';
import { Link } from 'react-router';
import { formatDateRange } from '../../resources/events/event-labels';
import type { DashboardEvent } from './dashboard-types';

interface LiveEventsCardProps {
  events: DashboardEvent[];
  total: number;
  canEdit: boolean;
}

function LiveEventRow({ event, canEdit }: { event: DashboardEvent; canEdit: boolean }) {
  const { token } = theme.useToken();
  const { total, official } = event.matches;
  const percent = total > 0 ? Math.round((official / total) * 1000) / 10 : 0;
  const place = event.venue ? [event.venue.name, event.venue.city].filter(Boolean).join(', ') : null;
  return (
    <Flex justify="space-between" align="center" wrap gap={token.margin} style={{ padding: `${token.paddingMD}px 0`, borderTop: `${token.lineWidth}px ${token.lineType} ${token.colorSplit}` }}>
      <Flex vertical gap={token.marginXXS} style={{ flex: '1 1 260px', minWidth: 0 }}>
        <Flex align="center" wrap gap={token.marginXS}>
          <Typography.Text strong>{event.name}</Typography.Text>
          <Tag color={event.eventType.colorHex ?? event.eventType.tier.colorHex} style={{ marginInlineEnd: 0 }}>{event.eventType.name}</Tag>
        </Flex>
        <Space size="middle" wrap>
          <Typography.Text type="secondary"><CalendarOutlined /> {formatDateRange(event)}</Typography.Text>
          {place && <Typography.Text type="secondary"><EnvironmentOutlined /> {place}</Typography.Text>}
        </Space>
        {total > 0 ? (
          <div>
            <Flex justify="space-between"><Typography.Text>Đã xong <strong>{official}/{total}</strong> trận</Typography.Text><Typography.Text type="secondary">{percent}%</Typography.Text></Flex>
            <Progress percent={percent} showInfo={false} size="small" aria-label={`Tiến độ ${event.name}`} />
          </div>
        ) : (
          <Typography.Text type="secondary">Chưa có trận nào được tạo</Typography.Text>
        )}
        <Space size="middle" wrap>
          {canEdit && <Link to={`/events/${event.id}/schedule`}>Lịch</Link>}
          {canEdit && <Link to={`/events/${event.id}/entries`}>Nhập Excel</Link>}
        </Space>
      </Flex>
      <Link to={`/events/${event.id}`}><Button>Vào giải <RightOutlined /></Button></Link>
    </Flex>
  );
}

export function LiveEventsCard({ events, total, canEdit }: LiveEventsCardProps) {
  return (
    <Card
      title={<Space>Giải đang diễn ra <Tag color="red">{total} giải</Tag></Space>}
      extra={<Link to="/events">Xem tất cả <RightOutlined /></Link>}
      styles={{ body: { paddingTop: 0, paddingBottom: 0 } }}
    >
      {events.map((event) => <LiveEventRow key={event.id} event={event} canEdit={canEdit} />)}
    </Card>
  );
}
