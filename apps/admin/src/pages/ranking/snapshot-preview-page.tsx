import { useCan } from '@refinedev/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Descriptions, Flex, Result, Skeleton, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { ConfirmActionButton, useConfirmAction } from '../../components/confirm-action-button';
import { useStepUp } from '../../components/step-up-modal';
import { SNAPSHOT_STATUS_COLORS, SNAPSHOT_STATUS_LABELS } from './ranking-labels';
import { formatSnapshotDate, type SnapshotRecord } from './ranking-snapshots-page';
import { SnapshotJobsTracker, type SnapshotJobRef, type SnapshotJobResult } from './snapshot-jobs-tracker';
import { SnapshotRankTable } from './snapshot-rank-table';
import { BackLink } from '../../components/back-link';

const snapshotKey = (id: string) => ['admin-ranking-snapshot', id];

/** Keyed by id so a different snapshot never shows the previous one's data or job state. */
export function SnapshotPreviewPage() {
  const { id = '' } = useParams();
  return <SnapshotPreview key={id} id={id} />;
}

function SnapshotPreview({ id }: { id: string }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirmAction();
  const runStepUp = useStepUp();
  const canPublish = useCan({ resource: 'rankings', action: 'publish' }).data?.can ?? false;
  const canDelete = useCan({ resource: 'rankings', action: 'delete' }).data?.can ?? false;
  const canCreate = useCan({ resource: 'rankings', action: 'create' }).data?.can ?? false;
  const [jobs, setJobs] = useState<SnapshotJobRef[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { data: snapshot, isLoading, error, refetch } = useQuery({
    queryKey: snapshotKey(id),
    queryFn: async () => (await apiFetch<{ data: SnapshotRecord }>(`/admin/ranking-snapshots/${encodeURIComponent(id)}`)).data,
    retry: false,
  });

  const onRebuilt = useCallback(
    (results: SnapshotJobResult[]) => {
      setRebuilding(false);
      const result = results[0];
      if (result?.outcome !== 'succeeded') return;
      const rebuilt = result.snapshotId;
      if (rebuilt !== id) navigate(`/ranking-snapshots/${rebuilt}`, { replace: true });
      else void refetch();
    },
    [id, navigate, refetch],
  );

  if (isLoading) return <Skeleton active />;
  if (error || !snapshot) {
    const notFound = error instanceof ApiError && error.statusCode === 404;
    return (
      <Flex vertical gap="middle">
        {jobs.length > 0 && <SnapshotJobsTracker key={jobs.map((job) => job.jobId).join()} jobs={jobs} onFinished={onRebuilt} />}
        <Result
          status={notFound ? '404' : 'error'}
          title={notFound ? 'Không tìm thấy kỳ chốt' : 'Không tải được kỳ chốt'}
          extra={notFound ? <Link to="/ranking-snapshots"><Button type="primary">Về danh sách kỳ chốt</Button></Link> : <Button onClick={() => refetch()}>Thử lại</Button>}
        />
      </Flex>
    );
  }

  const draft = snapshot.status === 'DRAFT';
  const title = `${snapshot.rankingList.name} · ${formatSnapshotDate(snapshot.asOfDate)}`;
  const dirty = snapshot.dirtySubEvents;

  // The recompute endpoint needs a sub-event or event type id; the draft job recomputes dirty sub-events itself before building.
  const rebuild = async () => {
    setRebuilding(true);
    try {
      const response = await apiFetch<{ data: { jobs: SnapshotJobRef[] } }>('/admin/ranking-snapshots/drafts', {
        method: 'POST',
        body: { listIds: [snapshot.rankingListId], asOfDate: snapshot.asOfDate.slice(0, 10) },
      });
      message.success('Đã gửi yêu cầu tính lại');
      setJobs(response.data.jobs);
    } catch (failure) {
      setRebuilding(false);
      message.error(failure instanceof ApiError ? failure.message : 'Không gửi được yêu cầu tính lại');
    }
  };

  const publish = () =>
    confirm({
      title: `Công bố BXH ${snapshot.rankingList.name} ngày ${formatSnapshotDate(snapshot.asOfDate)}?`,
      content: 'Trang công khai sẽ hiện bảng này; không sửa được sau khi công bố.',
      okText: 'Công bố',
      onConfirm: async () => {
        setPublishError(null);
        let response: unknown;
        try {
          response = await runStepUp(() => apiFetch(`/admin/ranking-snapshots/${snapshot.id}/publish`, { method: 'POST' }));
        } catch (failure) {
          if (!(failure instanceof ApiError) || failure.code !== 'RANKING_SNAPSHOT_STALE') throw failure;
          setPublishError(failure.message);
          await refetch();
          return;
        }
        message.success('Đã công bố bảng xếp hạng');
        showWarnings(message, warningsOf(response));
        await queryClient.invalidateQueries({ queryKey: snapshotKey(id) });
      },
    });

  const remove = async () => {
    await apiFetch(`/admin/ranking-snapshots/${snapshot.id}`, { method: 'DELETE' });
    message.success('Đã xóa bản nháp');
    navigate('/ranking-snapshots');
  };

  return (
    <Flex vertical gap="middle">
      <BackLink to="/ranking-snapshots">Kỳ chốt</BackLink>
      <Flex justify="space-between" align="start" wrap gap="middle">
        <Flex vertical gap="small">
          <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
          <Flex gap="small" align="center" wrap>
            <Tag color={SNAPSHOT_STATUS_COLORS[snapshot.status]}>{SNAPSHOT_STATUS_LABELS[snapshot.status]}</Tag>
          </Flex>
        </Flex>
        {draft && (
          <Flex gap="small">
            {canDelete && <ConfirmActionButton danger label="Xóa bản nháp" title="Xóa bản nháp này?" content="Không khôi phục được sau khi xóa." okText="Xóa" onConfirm={remove} />}
            {canPublish && (
              <Tooltip title={dirty > 0 ? `Còn ${dirty} nội dung chưa tính lại, hãy tính lại trước khi công bố` : undefined}>
                <span>
                  <Button type="primary" disabled={dirty > 0} onClick={publish}>Công bố</Button>
                </span>
              </Tooltip>
            )}
          </Flex>
        )}
      </Flex>
      <Descriptions size="small" bordered column={{ xs: 1, md: 3 }}>
        <Descriptions.Item label="Số VĐV">{snapshot._count.rows}</Descriptions.Item>
        <Descriptions.Item label="Nội dung chưa tính lại">{dirty}</Descriptions.Item>
        <Descriptions.Item label="Công bố">{snapshot.publishedAt ? `Đã công bố lúc ${dayjs(snapshot.publishedAt).format('HH:mm DD/MM/YYYY')}${snapshot.publishedBy ? ` bởi ${snapshot.publishedBy.name}` : ''}` : '—'}</Descriptions.Item>
      </Descriptions>
      {jobs.length > 0 && <SnapshotJobsTracker key={jobs.map((job) => job.jobId).join()} jobs={jobs} onFinished={onRebuilt} />}
      {publishError && <Alert type="error" showIcon closable message={publishError} onClose={() => setPublishError(null)} />}
      {draft && dirty > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${dirty} nội dung chưa tính lại`}
          description="Bản nháp này chưa phản ánh kết quả mới nhất. Tính lại sẽ dựng lại bản nháp."
          action={canCreate ? <Button size="small" loading={rebuilding} onClick={rebuild}>Tính lại ngay</Button> : undefined}
        />
      )}
      <SnapshotRankTable snapshotId={snapshot.id} />
    </Flex>
  );
}
