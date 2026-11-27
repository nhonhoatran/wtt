export interface SnapshotJobRef {
  listId: string;
  listCode: string;
  jobId: string;
}

export interface SnapshotJobStatus {
  state: string;
  failedReason: string | null;
  result: { outcome?: string; snapshotId?: string } | null;
}

export type SnapshotJobResult =
  | { listId: string; outcome: 'succeeded'; snapshotId: string }
  | { listId: string; outcome: 'failed' | 'unavailable'; snapshotId: null };

interface JobQueryState {
  data?: SnapshotJobStatus;
  error?: unknown;
}

/** Missing jobs and failed lookups say nothing about whether a draft was created. */
export function snapshotJobResult(job: SnapshotJobRef, query: JobQueryState): SnapshotJobResult | null {
  if (query.error) return { listId: job.listId, outcome: 'unavailable', snapshotId: null };
  if (query.data?.state === 'failed') return { listId: job.listId, outcome: 'failed', snapshotId: null };
  if (query.data?.state !== 'completed') return null;
  const snapshotId = query.data.result?.snapshotId;
  return typeof snapshotId === 'string' && snapshotId.trim()
    ? { listId: job.listId, outcome: 'succeeded', snapshotId }
    : { listId: job.listId, outcome: 'unavailable', snapshotId: null };
}

/** Callers may dismiss job feedback only when every job has its own confirmed draft. */
export function snapshotJobsSucceeded(results: SnapshotJobResult[]): boolean {
  return results.length > 0 && results.every((result) => result.outcome === 'succeeded');
}
