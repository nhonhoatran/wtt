import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Modal, Select, Skeleton, Space, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings } from '../../api/write-warnings';
import { matchesKey } from '../results/match-types';
import { AutoScheduleProposalView, type AutoScheduleProposal } from './auto-schedule-proposal';
import { scheduleKey, sessionDatedLabel, sessionsKey, type SessionRecord } from './schedule-types';

export function AutoScheduleModal({ eventId, sessionId, onClose }: { eventId: string; sessionId: string; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [proposal, setProposal] = useState<AutoScheduleProposal | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessions = useQuery({ queryKey: sessionsKey(eventId), queryFn: async () => (await apiFetch<{ data: SessionRecord[] }>(`/admin/events/${eventId}/sessions`)).data });
  const initial = sessions.data?.find((s) => s.id === sessionId && s.endTime && s.tables.length);
  // Undefined selection means the current bounded session; an explicit clear remains empty.
  const [edited, setEdited] = useState(false);
  const sessionIds = edited ? selected : initial ? [initial.id] : [];
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: scheduleKey(eventId) }),
    queryClient.invalidateQueries({ queryKey: sessionsKey(eventId) }),
    queryClient.invalidateQueries({ queryKey: matchesKey(eventId) }),
  ]);
  const preview = async () => {
    setBusy('preview'); setError(null); setProposal(null);
    try {
      setProposal((await apiFetch<{ data: AutoScheduleProposal }>(`/admin/events/${eventId}/auto-schedule/preview`, { method: 'POST', body: { sessionIds } })).data);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lấy được gợi ý lịch'); }
    finally { setBusy(null); }
  };
  const apply = async () => {
    if (!proposal) return;
    setBusy('apply'); setError(null);
    try {
      const res = await apiFetch<{ data: { assignments: unknown[] }; warnings?: string[] }>(`/admin/events/${eventId}/auto-schedule/apply`, { method: 'POST', body: { sessionIds, expectedFingerprint: proposal.fingerprint } });
      showWarnings(message, res.warnings);
      message.success(`Đã xếp ${res.data.assignments.length} trận`);
      await reload(); onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không áp dụng được gợi ý');
      if (e instanceof ApiError && e.statusCode === 409) { setProposal(null); await reload(); }
    } finally { setBusy(null); }
  };

  return (
    <Modal open title="Gợi ý xếp lịch" width={900} style={{ maxWidth: 'calc(100vw - 32px)' }} onCancel={onClose} closable={!busy} maskClosable={!busy} keyboard={!busy} footer={[
      <Button key="cancel" onClick={onClose} disabled={!!busy}>Đóng</Button>,
      <Button key="preview" onClick={() => void preview()} loading={busy === 'preview'} disabled={!!busy || !sessionIds.length || sessions.isError}>Xem gợi ý</Button>,
      <Button key="apply" type="primary" onClick={() => void apply()} loading={busy === 'apply'} disabled={!!busy || !proposal?.assignments.length}>Áp dụng {proposal?.assignments.length ?? 0} trận</Button>,
    ]}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="Giữ nguyên các trận đã có lịch" description="Gợi ý nối thêm trận vào cuối từng bàn, theo thứ tự vòng và giờ nghỉ; không chèn khoảng trống. Chọn buổi có giờ kết thúc và bàn thi đấu. Kiểm tra trùng VĐV và bàn trong giải này." />
        <Typography.Text strong>Buổi thi đấu</Typography.Text>
        {sessions.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : sessions.isError ? <Alert type="error" message="Không tải được buổi thi đấu" action={<Button onClick={() => void sessions.refetch()}>Thử lại</Button>} /> : <Select aria-label="Buổi dùng để gợi ý" mode="multiple" style={{ width: '100%' }} value={sessionIds} maxCount={32} maxTagCount="responsive" disabled={!!busy} onChange={(ids) => { setEdited(true); setSelected(ids); setProposal(null); setError(null); }} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: `${sessionDatedLabel(s)}${!s.endTime ? ' · cần giờ kết thúc' : !s.tables.length ? ' · cần bàn thi đấu' : ''}`, disabled: !s.endTime || !s.tables.length }))} />}
        {error && <Alert role="alert" type="error" showIcon message={error} />}
        {proposal && <AutoScheduleProposalView proposal={proposal} />}
      </Space>
    </Modal>
  );
}
