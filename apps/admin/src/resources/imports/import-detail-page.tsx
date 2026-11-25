import { useCan } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Result, Skeleton, Spin, Statistic, Tag, Typography, theme } from 'antd';
import { Link, useParams } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { ImportPreviewTable } from '../../components/import-preview-table';
import { ImportStepsBar } from '../../components/import-wizard';
import { ImportCommitBar } from './import-commit-bar';
import { ImportRevalidateButton } from './import-revalidate-button';
import { BUSY_STATUSES, formatFileSize, IMPORT_POLL_MS, IMPORT_STATUS_COLORS, IMPORT_STATUS_LABELS, importKey, type ImportJob } from './import-labels';
import { BackLink } from '../../components/back-link';

const BUSY_TEXT: Partial<Record<ImportJob['status'], string>> = {
  UPLOADED: 'Đã nhận file, đang chờ kiểm tra…',
  VALIDATING: 'Đang kiểm tra từng dòng…',
  COMMITTING: 'Đang nhập dữ liệu…',
};

/** Step 3 of the import wizard: follows the worker, previews rows, lets the operator decide and commit. */
export function ImportDetailPage() {
  const { id = '' } = useParams();
  const { token } = theme.useToken();
  const canOverride = useCan({ resource: 'tournaments', action: 'manage' }).data?.can ?? false;
  const canUpdate = useCan({ resource: 'tournaments', action: 'update' }).data?.can ?? false;
  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: importKey(id),
    queryFn: async () => (await apiFetch<{ data: ImportJob }>(`/admin/imports/${encodeURIComponent(id)}`)).data,
    refetchInterval: (query) => (query.state.data && BUSY_STATUSES.includes(query.state.data.status) ? IMPORT_POLL_MS : false),
    retry: false,
  });

  if (isLoading) return <Skeleton active />;
  if (error || !job) {
    const notFound = error instanceof ApiError && error.statusCode === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Không tìm thấy lượt import' : 'Không tải được lượt import'}
        extra={notFound ? <Link to="/imports"><Button type="primary">Về lịch sử import</Button></Link> : <Button onClick={() => refetch()}>Thử lại</Button>}
      />
    );
  }

  const busy = BUSY_STATUSES.includes(job.status);
  const entriesLink = `/events/${job.eventId}/entries`;
  const committed = job.countsByStatus?.COMMITTED ?? job.committedRows ?? 0;
  const retry = job.status === 'FAILED' && job.totalRows !== null;
  const canRevalidate = canUpdate && (job.status === 'VALIDATED' || job.status === 'FAILED') && committed === 0;
  const showRows = ['VALIDATED', 'DONE', 'FAILED', 'COMMITTING'].includes(job.status) && job.totalRows !== null;

  return (
    <Flex vertical gap="middle">
      <BackLink to={entriesLink}>Danh sách đăng ký – {job.event.name}</BackLink>
      <Flex justify="space-between" align="start" wrap gap="middle">
        <Flex vertical gap="small">
          <Typography.Title level={3} style={{ margin: 0 }}>Import: {job.fileName}</Typography.Title>
          <Flex gap="small" align="center" wrap>
            <Tag color={IMPORT_STATUS_COLORS[job.status]}>{IMPORT_STATUS_LABELS[job.status]}</Tag>
            <Typography.Text type="secondary">{formatFileSize(job.fileSize)}</Typography.Text>
          </Flex>
        </Flex>
      </Flex>
      <Card>
        <Flex vertical gap={token.margin}>
          <ImportStepsBar current={job.status === 'DONE' ? 3 : 2} />
          {busy && (
            <Alert type="info" showIcon icon={<Spin size="small" />} message={BUSY_TEXT[job.status]} description="Trang tự cập nhật, bạn có thể rời trang rồi quay lại sau." />
          )}
          {job.status === 'AWAITING_UPLOAD' && (
            <Alert type="warning" showIcon message="File chưa được tải lên." description={<Link to={entriesLink}>Mở lại "Import Excel" ở tab Danh sách để tải file.</Link>} />
          )}
          {job.status === 'FAILED' && <Alert type="error" showIcon message="Import bị lỗi" description={job.failureReason ?? 'Không rõ nguyên nhân.'} />}
          {job.status === 'DONE' && (
            <Alert type="success" showIcon message={`Đã nhập ${job.committedRows ?? 0} dòng.`} action={<Link to={entriesLink}><Button size="small" type="primary">Xem danh sách đăng ký</Button></Link>} />
          )}
          {job.totalRows !== null && (
            <Flex gap="large" wrap>
              <Statistic title="Tổng dòng" value={job.totalRows} />
              <Statistic title="Hợp lệ" value={job.countsByStatus?.VALID ?? job.validRows ?? 0} />
              <Statistic title="Cần xác nhận" value={job.countsByStatus?.NEEDS_CONFIRM ?? job.needsConfirmRows ?? 0} />
              <Statistic title="Lỗi" value={job.countsByStatus?.ERROR ?? job.errorRows ?? 0} />
              <Statistic title="Đã nhập" value={job.countsByStatus?.COMMITTED ?? job.committedRows ?? 0} />
            </Flex>
          )}
          {canUpdate && (job.status === 'VALIDATED' || retry) && <ImportCommitBar job={job} canOverride={canOverride} retry={retry} onStarted={refetch} />}
          {canRevalidate && <ImportRevalidateButton importId={job.id} onStarted={refetch} />}
        </Flex>
      </Card>
      {showRows && <ImportPreviewTable key={job.status} job={job} editable={canUpdate && job.status === 'VALIDATED'} onDecided={() => void refetch()} />}
    </Flex>
  );
}
