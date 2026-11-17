import { useQueries } from '@tanstack/react-query';
import { Alert, Spin } from 'antd';
import { useEffect, useRef } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';

/** Fixed: how often the page asks the queue whether a snapshot job finished. */
const SNAPSHOT_JOB_POLL_MS = 2_000;

export interface SnapshotJobRef {
  listId: string;
  listCode: string;
  jobId: string;
}

export interface SnapshotJobResult {
  listId: string;
  snapshotId: string | null;
}

interface JobStatus {
  state: string;
  failedReason: string | null;
  result: { outcome?: string; snapshotId?: string } | null;
}

const isFinished = (job: JobStatus | undefined) => job?.state === 'completed' || job?.state === 'failed';

/** The worker reports "N sub-event(s) not recomputed" when dirty sub-events survive a recompute pass. */
function failureText(reason: string | null): string {
  const dirty = /(\d+) sub-event\(s\) not recomputed/.exec(reason ?? '');
  return dirty ? `${dirty[1]} nội dung chưa tính lại được` : (reason ?? 'Không rõ nguyên nhân');
}

interface SnapshotJobsTrackerProps {
  jobs: SnapshotJobRef[];
  onFinished: (results: SnapshotJobResult[]) => void;
}

/** Follows the queued build-snapshot jobs and reports once every one has completed or failed. */
export function SnapshotJobsTracker({ jobs, onFinished }: SnapshotJobsTrackerProps) {
  const statuses = useQueries({
    queries: jobs.map((job) => ({
      queryKey: ['admin-ranking-job', job.jobId],
      queryFn: async () => (await apiFetch<{ data: JobStatus }>(`/admin/ranking/jobs/${encodeURIComponent(job.jobId)}`)).data,
      refetchInterval: (query: { state: { data?: JobStatus; error: unknown } }) => (isFinished(query.state.data) || query.state.error ? false : SNAPSHOT_JOB_POLL_MS),
      retry: false,
    })),
  });

  // A job that expired from the queue (404) was already cleaned up after completing; treat it as done.
  const expired = (error: unknown) => error instanceof ApiError && error.statusCode === 404;
  const done = statuses.map((status) => isFinished(status.data) || Boolean(status.error));
  const unreachable = jobs.filter((_, index) => statuses[index]?.error && !expired(statuses[index]?.error));
  const allDone = done.every(Boolean);
  const reported = useRef(false);
  useEffect(() => {
    if (!allDone || reported.current) return;
    reported.current = true;
    onFinished(jobs.map((job, index) => ({ listId: job.listId, snapshotId: statuses[index]?.data?.result?.snapshotId ?? null })));
  }, [allDone, jobs, statuses, onFinished]);

  const failed = jobs.flatMap((job, index) => (statuses[index]?.data?.state === 'failed' ? [{ job, reason: statuses[index]?.data?.failedReason ?? null }] : []));

  return (
    <>
      {!allDone && (
        <Alert type="info" showIcon icon={<Spin size="small" />} message={`Đang dựng bản nháp (${done.filter(Boolean).length}/${jobs.length})…`} description="Trang tự cập nhật khi xong." />
      )}
      {unreachable.length > 0 && (
        <Alert type="error" showIcon message="Không kiểm tra được tiến độ dựng bản nháp" description={`Bảng: ${unreachable.map((job) => job.listCode).join(', ')}. Tải lại trang để xem kết quả.`} />
      )}
      {failed.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="Không dựng được bản nháp"
          description={failed.map(({ job, reason }) => (
            <div key={job.jobId}>
              {job.listCode}: {failureText(reason)}
            </div>
          ))}
        />
      )}
    </>
  );
}
