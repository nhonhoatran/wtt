import { CheckCircleOutlined, ClockCircleOutlined, EditOutlined, PlusOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Col, Result, Row, Tag, theme } from 'antd';
import { Link } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { PageHeader } from '../../components/page-header';
import { StatCard } from '../../components/stat-card';
import type { CurrentUser } from '../../providers/current-user';
import { DASHBOARD_SUMMARY_KEY, type DashboardSummary } from './dashboard-types';
import { LiveEventsCard } from './live-events-card';
import { todayText } from './pending-match-status';
import { PendingMatchesTable } from './pending-matches-table';
import { QuickActionsCard } from './quick-actions-card';
import { RecentActivityCard } from './recent-activity-card';

/** Home for roles that manage tournaments: every number comes from /admin/dashboard, nothing is counted in the browser. */
export function DashboardPage({ user }: { user: CurrentUser }) {
  const { token } = theme.useToken();
  const has = (key: CurrentUser['permissions'][number]) => user.permissions.includes(key);
  const canSeeSummary = has('tournaments.list');
  const summary = useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: async () => (await apiFetch<{ data: DashboardSummary }>('/admin/dashboard/summary')).data,
    enabled: canSeeSummary,
    refetchOnWindowFocus: true,
  });
  const data = summary.data;
  const subtitle = [
    todayText(new Date()),
    data && (data.liveEvents > 0 ? `Hôm nay có ${data.liveEvents} giải đang diễn ra` : 'Hôm nay chưa có giải nào đang diễn ra'),
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={subtitle}
        actions={
          <>
            {has('matches.list') && <Link to="/results"><Button icon={<EditOutlined />}>Nhập kết quả</Button></Link>}
            {has('tournaments.create') && <Link to="/events/create"><Button type="primary" icon={<PlusOutlined />}>Thêm giải đấu</Button></Link>}
          </>
        }
      />
      {summary.isError && (
        <Result status="warning" title="Không tải được số liệu tổng quan" extra={<Button onClick={() => summary.refetch()}>Thử lại</Button>} />
      )}
      {canSeeSummary && !summary.isError && (
        <Row gutter={[token.margin, token.margin]} style={{ marginBottom: token.margin }}>
          <Col xs={24} sm={12} xl={6}><StatCard label="Giải đang diễn ra" value={data?.liveEvents ?? 0} icon={<TrophyOutlined />} loading={!data} /></Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              label="Trận chờ kết quả hôm nay"
              value={data?.pendingToday ?? 0}
              icon={<ClockCircleOutlined />}
              loading={!data}
              note={data && data.overdueToday > 0 ? <Tag color="gold" style={{ marginInlineEnd: 0, width: 'fit-content' }}>Cần xử lý: {data.overdueToday} trận quá giờ</Tag> : undefined}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}><StatCard label="Trận đã xong hôm nay" value={data?.finishedToday ?? 0} icon={<CheckCircleOutlined />} loading={!data} /></Col>
          <Col xs={24} sm={12} xl={6}><StatCard label="VĐV đang thi đấu" value={data?.activePlayers ?? 0} icon={<TeamOutlined />} loading={!data} /></Col>
        </Row>
      )}
      <Row gutter={[token.margin, token.margin]} align="top">
        <Col xs={24} xl={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.margin }}>
            {data && data.events.length > 0 && (
              <LiveEventsCard events={data.events} total={data.liveEvents} canEdit={has('tournaments.update')} />
            )}
            {has('matches.list') && <PendingMatchesTable showEvent={(data?.liveEvents ?? 0) > 1} />}
          </div>
        </Col>
        <Col xs={24} xl={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.margin }}>
            <QuickActionsCard permissions={user.permissions} />
            {has('audit-logs.list') && data && data.recentActivityLimit > 0 && <RecentActivityCard limit={data.recentActivityLimit} />}
          </div>
        </Col>
      </Row>
    </>
  );
}
