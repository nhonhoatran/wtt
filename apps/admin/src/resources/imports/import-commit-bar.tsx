import { Checkbox, Flex, Input, Typography, theme } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import type { ImportJob } from './import-labels';

interface ImportCommitBarProps {
  job: ImportJob;
  /** ADMIN only: may import into sub-events whose draw is already locked, with a reason. */
  canOverride: boolean;
  /** FAILED after validation: the same call commits the rows that are not yet committed (an ADMIN may add an override reason). */
  retry?: boolean;
  onStarted: () => Promise<unknown>;
}

export function ImportCommitBar({ job, canOverride, retry, onStarted }: ImportCommitBarProps) {
  const { token } = theme.useToken();
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState('');
  const ready = job.countsByStatus?.VALID ?? job.validRows ?? 0;
  const pendingConfirm = job.countsByStatus?.NEEDS_CONFIRM ?? 0;
  const skipped = (job.countsByStatus?.ERROR ?? 0) + pendingConfirm;
  const needsReason = override && !reason.trim();

  const commit = async () => {
    await apiFetch(`/admin/imports/${job.id}/commit`, { method: 'POST', body: override ? { overrideReason: reason.trim() } : {} });
    await onStarted();
  };

  return (
    <Flex vertical gap={token.marginXS}>
      {canOverride && (
        <Flex gap="small" align="center" wrap>
          <Checkbox checked={override} onChange={(event) => setOverride(event.target.checked)}>
            Nhập cả vào nội dung đã khóa nhánh đấu
          </Checkbox>
          {override && (
            <Input
              placeholder="Lý do (bắt buộc, ghi vào nhật ký)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              status={needsReason ? 'error' : undefined}
              maxLength={500}
              style={{ maxWidth: 360 }}
            />
          )}
        </Flex>
      )}
      <Flex gap="small" align="center" wrap>
        <ConfirmActionButton
          label={retry ? 'Thử lại' : `Nhập ${ready} dòng`}
          title={retry ? 'Nhập tiếp các dòng chưa nhập?' : `Nhập ${ready} dòng hợp lệ?`}
          content={skipped > 0 ? `${skipped} dòng lỗi hoặc chưa xác nhận sẽ bị bỏ qua.` : 'Dòng đã nhập sẽ không bị nhập lại.'}
          okText={retry ? 'Thử lại' : 'Nhập'}
          buttonProps={{ type: 'primary', disabled: (!retry && ready === 0) || needsReason }}
          onConfirm={commit}
        />
        {pendingConfirm > 0 && (
          <Typography.Text type="warning">Còn {pendingConfirm} dòng chưa chọn VĐV (tab "Cần xác nhận"); chưa chọn thì dòng đó bị bỏ qua.</Typography.Text>
        )}
      </Flex>
    </Flex>
  );
}
