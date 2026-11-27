import { useCan } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Tooltip } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useConfirmAction } from '../../components/confirm-action-button';
import { useStepUp } from '../../components/step-up-modal';
import { publishConfirmLines } from './ranking-board-labels';
import { formatSnapshotDate } from './ranking-snapshots-page';
import { SnapshotDraftModal } from './snapshot-draft-modal';
import { SnapshotJobsTracker, type SnapshotJobRef } from './snapshot-jobs-tracker';
import { snapshotJobsSucceeded } from './snapshot-job-state';
import type { BoardSnapshot, BoardSummary } from './use-current-snapshot';

interface BoardActionsProps {
  listId: string;
  snapshot: BoardSnapshot | null;
  summary: BoardSummary | undefined;
}

/** Header buttons of the board plus the feedback that follows them (job progress, stale-draft error). */
export function useRankingBoardActions({ listId, snapshot, summary }: BoardActionsProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirmAction();
  const runStepUp = useStepUp();
  const canPublish = useCan({ resource: 'rankings', action: 'publish' }).data?.can ?? false;
  const canCreate = useCan({ resource: 'rankings', action: 'create' }).data?.can ?? false;
  const [jobs, setJobs] = useState<SnapshotJobRef[]>([]);
  const [creating, setCreating] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-ranking-board'] });
  const draft = snapshot?.status === 'DRAFT';
  const dirty = snapshot?.dirtySubEvents ?? 0;

  const rebuild = async () => {
    if (!snapshot) return;
    setRebuilding(true);
    try {
      const response = await apiFetch<{ data: { jobs: SnapshotJobRef[] } }>('/admin/ranking-snapshots/drafts', {
        method: 'POST',
        body: { listIds: [listId], asOfDate: snapshot.asOfDate.slice(0, 10) },
      });
      setJobs(response.data.jobs);
    } catch (failure) {
      setRebuilding(false);
      message.error(failure instanceof ApiError ? failure.message : 'Không gửi được yêu cầu tính lại');
    }
  };

  const publish = () => {
    if (!snapshot || !summary) return;
    confirm({
      title: `Chốt bảng xếp hạng ${snapshot.rankingList.name} ngày ${formatSnapshotDate(snapshot.asOfDate)}?`,
      content: (
        <Flex vertical gap={4}>
          {publishConfirmLines({
            listName: snapshot.rankingList.name,
            asOfDate: snapshot.asOfDate,
            rows: summary.rows,
            changed: summary.changed,
            newcomers: summary.newcomers,
            hasPrevious: Boolean(summary.previous),
          }).map((line) => <span key={line}>{line}</span>)}
          <span>Bước tiếp theo: nhập lại mật khẩu để xác nhận.</span>
        </Flex>
      ),
      okText: 'Chốt bảng',
      onConfirm: async () => {
        setPublishError(null);
        let response: unknown;
        try {
          response = await runStepUp(() => apiFetch(`/admin/ranking-snapshots/${snapshot.id}/publish`, { method: 'POST' }));
        } catch (failure) {
          if (!(failure instanceof ApiError) || failure.code !== 'RANKING_SNAPSHOT_STALE') throw failure;
          setPublishError(failure.message);
          await refresh();
          return;
        }
        message.success('Đã chốt bảng xếp hạng');
        showWarnings(message, warningsOf(response));
        await refresh();
      },
    });
  };

  const actions = (
    <>
      <Button onClick={() => navigate(`/ranking-snapshots?filters[0][field]=listId&filters[0][operator]=eq&filters[0][value]=${encodeURIComponent(listId)}`)}>
        Lịch sử các kỳ
      </Button>
      {draft && canPublish && (
        <Tooltip title={dirty > 0 ? `Còn ${dirty} nội dung chưa tính lại, hãy tính lại trước khi chốt` : undefined}>
          <span>
            <Button type="primary" disabled={dirty > 0} loading={!summary} onClick={publish}>Chốt bảng kỳ này</Button>
          </span>
        </Tooltip>
      )}
      {!draft && canCreate && <Button type="primary" onClick={() => setCreating(true)}>Tạo bản tạm tính</Button>}
    </>
  );

  const feedback = (
    <>
      {jobs.length > 0 && (
        <SnapshotJobsTracker
          key={jobs.map((job) => job.jobId).join()}
          jobs={jobs}
          onFinished={(results) => {
            if (snapshotJobsSucceeded(results)) setJobs([]);
            setRebuilding(false);
            void refresh();
          }}
        />
      )}
      {publishError && <Alert type="error" showIcon closable message={publishError} onClose={() => setPublishError(null)} />}
      {draft && dirty > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${dirty} nội dung chưa tính lại`}
          description="Bản tạm tính này chưa phản ánh kết quả mới nhất. Tính lại sẽ dựng lại bản tạm tính."
          action={canCreate ? <Button size="small" loading={rebuilding} onClick={rebuild}>Tính lại ngay</Button> : undefined}
        />
      )}
      <SnapshotDraftModal
        open={creating}
        defaultListIds={[listId]}
        onClose={() => setCreating(false)}
        onQueued={(queued) => {
          setCreating(false);
          setJobs(queued);
        }}
      />
    </>
  );

  return { actions, feedback };
}
