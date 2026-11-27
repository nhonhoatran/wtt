import { Alert, Space, Table, Typography } from 'antd';
import { timeInZone } from './schedule-types';

interface Assignment {
  matchId: string; matchNo: number; sessionId: string; sessionCode: string;
  tableId: string; tableCode: string; orderInSession: number; scheduledAt: string;
}
interface Skipped { matchId: string; matchNo: number; reason: string }
export interface AutoScheduleProposal {
  assignments: Assignment[];
  skipped: Skipped[];
  fingerprint: string;
  timeZone: string;
  minRestMinutes: number;
}

const REASONS: Record<string, string> = {
  UNRESOLVED_PLAYERS: 'Chưa xác định được các VĐV có thể thi đấu',
  DEPENDENCY_NOT_SCHEDULED: 'Trận trước chưa có lịch phù hợp',
  NO_COMPATIBLE_SLOT: 'Không còn chỗ phù hợp với thời lượng, giờ nghỉ hoặc giới hạn buổi',
};

export function AutoScheduleProposalView({ proposal }: { proposal: AutoScheduleProposal }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert type={proposal.assignments.length ? 'success' : 'warning'} showIcon message={`Gợi ý ${proposal.assignments.length} trận · chưa xếp ${proposal.skipped.length} trận`} description={`Giờ nghỉ tối thiểu ${proposal.minRestMinutes} phút. Giờ hiển thị theo ${proposal.timeZone}. Các trận chưa xếp vẫn có thể được xếp thủ công.`} />
      <Table size="small" rowKey="matchId" dataSource={proposal.assignments} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 540 }} columns={[
        { title: 'Trận', dataIndex: 'matchNo', render: (no: number) => `#${no}` },
        { title: 'Buổi', dataIndex: 'sessionCode' },
        { title: 'Bàn', dataIndex: 'tableCode' },
        { title: 'Thứ tự', dataIndex: 'orderInSession' },
        { title: 'Bắt đầu', dataIndex: 'scheduledAt', render: (at: string) => `${new Intl.DateTimeFormat('vi-VN', { timeZone: proposal.timeZone, day: '2-digit', month: '2-digit' }).format(new Date(at))} ${timeInZone(at, proposal.timeZone)}` },
      ]} />
      {proposal.skipped.length > 0 && <>
        <Typography.Text strong>Trận chưa xếp</Typography.Text>
        <Table size="small" rowKey="matchId" dataSource={proposal.skipped} pagination={{ pageSize: 5, showSizeChanger: false }} columns={[
          { title: 'Trận', dataIndex: 'matchNo', width: 80, render: (no: number) => `#${no}` },
          { title: 'Lý do', dataIndex: 'reason', render: (reason: string) => REASONS[reason] ?? reason },
        ]} />
      </>}
    </Space>
  );
}
