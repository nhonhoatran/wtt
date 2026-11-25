import { CalendarOutlined, SwapOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { Col, Row, Tooltip } from 'antd';
import { StatCard } from '../../components/stat-card';
import type { BoardSummary } from './use-current-snapshot';

interface RankingBoardStatsProps {
  summary: BoardSummary | undefined;
  loading: boolean;
}

/** Four period KPIs. Comparisons need a previous period, so they read "—" for a list's first one. */
export function RankingBoardStats({ summary, loading }: RankingBoardStatsProps) {
  const comparable = Boolean(summary?.previous);
  const compare = (value: number | undefined) => (comparable && value !== undefined ? value : '—');
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} lg={6}>
        <StatCard label="VĐV có điểm" value={summary?.rows ?? '—'} icon={<TeamOutlined />} loading={loading} />
      </Col>
      <Col xs={12} lg={6}>
        <StatCard label="Thay đổi thứ hạng" value={compare(summary?.changed)} icon={<SwapOutlined />} note="so với kỳ trước" loading={loading} />
      </Col>
      <Col xs={12} lg={6}>
        <StatCard label="VĐV mới" value={compare(summary?.newcomers)} icon={<UserAddOutlined />} note="chưa có trong kỳ trước" loading={loading} />
      </Col>
      <Col xs={12} lg={6}>
        <Tooltip title="Tổng điểm có hạn dùng kết thúc từ sau ngày chốt kỳ trước đến ngày chốt kỳ này">
          <div>
            <StatCard label="Điểm hết hạn trong kỳ" value={compare(summary?.expiredPoints)} icon={<CalendarOutlined />} loading={loading} />
          </div>
        </Tooltip>
      </Col>
    </Row>
  );
}
