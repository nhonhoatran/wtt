import { useQueries } from '@tanstack/react-query';
import { Alert, Button, Flex, Spin } from 'antd';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { snapshotJobResult, type SnapshotJobRef, type SnapshotJobResult, type SnapshotJobStatus } from './snapshot-job-state';

export type { SnapshotJobRef, SnapshotJobResult } from './snapshot-job-state';

/** Fixed: how often the page asks the queue whether a snapshot job finished. */
const SNAPSHOT_JOB_POLL_MS = 2_000;

/** The worker reports "N sub-event(s) not recomputed" when dirty sub-events survive a recompute pass. */
function failureText(reason: string | null): string {
  const dirty = /(\d+) sub-event\(s\) not recomputed/.exec(reason ?? '');
  return dirty ? `${dirty[1]} nội dung chưa tính lại được` : (reason ?? 'Không rõ nguyên nhân');
}

interface SnapshotJobsTrackerProps {
  jobs: SnapshotJobRef[];
  onFinished: (results: SnapshotJobResult[]) => void;
}

function unavailableText(error: unknown): string {
  if (error instanceof ApiError && error.statusCode === 404) return 'Không còn thông tin tiến độ. Kiểm tra lịch sử kỳ chốt trước khi tạo lại.';
  if (error instanceof ApiError) return error.message;
  return 'Chưa nhận được kết quả dựng bản nháp. Kiểm tra lại tiến độ hoặc xem lịch sử kỳ chốt.';
}

/** Reports a settled batch, preserving failures/unknown outcomes; a retry can report a new result. */
export function SnapshotJobsTracker({ jobs, onFinished }: SnapshotJobsTrackerProps) {
  const statuses = useQueries({
    queries: jobs.map((job) => ({
      queryKey: ['admin-ranking-job', job.jobId],
      queryFn: async () => (await apiFetch<{ data: SnapshotJobStatus }>(`/admin/ranking/jobs/${encodeURIComponent(job.jobId)}`)).data,
      refetchInterval: (query: { state: { data?: SnapshotJobStatus; error: unknown } }) => (snapshotJobResult(job, query.state) ? false : SNAPSHOT_JOB_POLL_MS),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });

  const outcomes = jobs.map((job, index) => snapshotJobResult(job, statuses[index] ?? {}));
  const results = outcomes.filter((result): result is SnapshotJobResult => result !== null);
  const allDone = jobs.length > 0 && results.length === jobs.length;
  const checking = statuses.some((status) => status.isFetching);
  const reportKey = allDone && !checking ? JSON.stringify(results) : null;
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!reportKey) {
      reported.current = null;
      return;
    }
    if (reported.current === reportKey) return;
    reported.current = reportKey;
    onFinished(results);
  }, [reportKey, results, onFinished]);

  const unavailable = jobs.flatMap((job, index) => (outcomes[index]?.outcome === 'unavailable' ? [{ job, status: statuses[index] }] : []));
  const failed = jobs.flatMap((job, index) => (outcomes[index]?.outcome === 'failed' ? [{ job, reason: statuses[index]?.data?.failedReason ?? null }] : []));
  const history = <Link to="/ranking-snapshots"><Button size="small">Xem lịch sử kỳ chốt</Button></Link>;

  return (
    <>
      {!allDone && (
        <Alert type="info" showIcon icon={<Spin size="small" />} message={`Đang dựng bản nháp (${results.length}/${jobs.length})…`} description="Trang tự cập nhật khi xong." />
      )}
      {unavailable.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Chưa xác định được kết quả dựng bản nháp"
          description={
            <Flex vertical gap="small">
              {unavailable.map(({ job, status }) => <div key={job.jobId}>{job.listCode}: {unavailableText(status?.error)}</div>)}
              <Flex gap="small" wrap>
                <Button size="small" loading={checking} onClick={() => { for (const { status } of unavailable) void status?.refetch(); }}>Kiểm tra lại</Button>
                {history}
              </Flex>
            </Flex>
          }
        />
      )}
      {failed.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="Không dựng được bản nháp"
          description={
            <Flex vertical gap="small">
              {failed.map(({ job, reason }) => <div key={job.jobId}>{job.listCode}: {failureText(reason)}</div>)}
              <div>{history}</div>
            </Flex>
          }
        />
      )}
    </>
  );
}
