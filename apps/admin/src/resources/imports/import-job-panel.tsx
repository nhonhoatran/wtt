import { useCan } from '@refinedev/core';
import { Alert, Button, Flex, Spin, theme } from 'antd';
import { useEffect, useRef, type ReactNode } from 'react';
import { ImportPreviewTable } from '../../components/import-preview-table';
import { ImportCommitBar } from './import-commit-bar';
import { BUSY_STATUSES, type ImportJob } from './import-labels';
import { ImportRevalidateButton } from './import-revalidate-button';
import { ImportStepsBar } from './import-steps-bar';
import { ImportSummaryChips } from './import-summary-chips';

const BUSY_TEXT: Partial<Record<ImportJob['status'], string>> = {
  UPLOADED: 'Đã nhận file, đang chờ kiểm tra…',
  VALIDATING: 'Đang kiểm tra từng dòng…',
  COMMITTING: 'Đang nhập dữ liệu…',
};

const stepOf = (status: ImportJob['status']) => (status === 'AWAITING_UPLOAD' ? 0 : status === 'DONE' ? 3 : status === 'VALIDATED' || status === 'FAILED' || status === 'COMMITTING' ? 2 : 1);

interface ImportJobPanelProps {
  job: ImportJob;
  refetch: () => Promise<unknown>;
  /** Fired once when the job is seen DONE, so the host can refresh its lists. */
  onDone?: () => void;
  /** Offers "Tải file khác" while nothing has been committed yet. */
  onRestart?: () => void;
  /** Shown in the success alert. */
  doneAction?: ReactNode;
}

/** Steps 2–3 of the Excel import: follows the worker, previews rows, lets the operator decide and commit. */
export function ImportJobPanel({ job, refetch, onDone, onRestart, doneAction }: ImportJobPanelProps) {
  const { token } = theme.useToken();
  const canOverride = useCan({ resource: 'tournaments', action: 'manage' }).data?.can ?? false;
  const canUpdate = useCan({ resource: 'tournaments', action: 'update' }).data?.can ?? false;
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (job.status === 'DONE' && notified.current !== job.id) {
      notified.current = job.id;
      onDone?.();
    }
  }, [job.id, job.status, onDone]);

  const busy = BUSY_STATUSES.includes(job.status);
  const committed = job.countsByStatus?.COMMITTED ?? job.committedRows ?? 0;
  const errors = job.countsByStatus?.ERROR ?? job.errorRows ?? 0;
  const retry = job.status === 'FAILED' && job.totalRows !== null;
  const canCommit = canUpdate && (job.status === 'VALIDATED' || retry);
  const canRevalidate = canUpdate && (job.status === 'VALIDATED' || job.status === 'FAILED') && committed === 0;
  const showRows = ['VALIDATED', 'DONE', 'FAILED', 'COMMITTING'].includes(job.status) && job.totalRows !== null;
  const restart = onRestart && committed === 0 && !busy && job.status !== 'DONE';

  return (
    <Flex vertical gap={token.margin}>
      <ImportStepsBar current={stepOf(job.status)} />
      {busy && <Alert type="info" showIcon icon={<Spin size="small" />} message={BUSY_TEXT[job.status]} description="Trang tự cập nhật, bạn có thể rời trang rồi quay lại sau." />}
      {job.status === 'AWAITING_UPLOAD' && <Alert type="warning" showIcon message="File chưa được tải lên." description={onRestart ? 'Chọn lại file Excel để tải lên.' : 'Mở tab Danh sách của giải rồi chọn "Nhập từ Excel" để tải file.'} />}
      {job.status === 'FAILED' && <Alert type="error" showIcon message="Import bị lỗi" description={job.failureReason ?? 'Không rõ nguyên nhân.'} />}
      {job.status === 'DONE' && <Alert type="success" showIcon message={`Đã nhập ${job.committedRows ?? 0} dòng.`} action={doneAction} />}
      <ImportSummaryChips job={job} />
      {job.status === 'VALIDATED' && errors > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`Có ${errors} dòng lỗi`}
          description={`Các dòng lỗi sẽ không được nhập. Xem tab "Lỗi" bên dưới để biết sửa thế nào, sửa trong file Excel rồi ${onRestart ? 'bấm "Tải file khác"' : 'tải lại file'}.`}
        />
      )}
      {showRows && <ImportPreviewTable key={job.status} job={job} editable={canUpdate && job.status === 'VALIDATED'} onDecided={() => void refetch()} />}
      {(restart || canCommit || canRevalidate) && (
        <Flex gap="small" align="end" wrap>
          {restart && <Button onClick={onRestart}>Tải file khác</Button>}
          {canCommit && <ImportCommitBar job={job} canOverride={canOverride} retry={retry} onStarted={refetch} />}
          {canRevalidate && <ImportRevalidateButton importId={job.id} onStarted={refetch} />}
        </Flex>
      )}
    </Flex>
  );
}
