import { createHash } from 'node:crypto';
import { subEventsWithLockedDraw } from '@kamito/db';
import { playerSettings } from '@kamito/shared';
import { commitBatch, committableWhere } from '../import/commit-batch.js';
import type { BatchState, CommitSettings, CreatedEntities } from '../import/commit-types.js';
import { readSetting, type ImportDeps } from '../import/import-deps.js';
import { failImportJob } from '../import/import-job-state.js';
import { ImportFailure, type RowData } from '../import/import-row-types.js';
import { loadSubEventInfos } from '../import/validation-context.js';

const BATCH_SIZE = 200;
const TX_TIMEOUT_MS = 120_000;

export type CommitOutcome = 'skipped' | 'done' | 'failed';

async function assertFileUnchanged(deps: ImportDeps, job: { fileKey: string; fileSha256: string | null; fileDeletedAt: Date | null }): Promise<void> {
  if (job.fileDeletedAt || !(await deps.storage.stat(job.fileKey))) throw new ImportFailure('File import đã bị xóa do quá hạn lưu, hãy tải lên lại');
  const hash = createHash('sha256').update(await deps.storage.get(job.fileKey)).digest('hex');
  if (hash !== job.fileSha256) throw new ImportFailure('File đã thay đổi sau khi kiểm tra');
}

async function assertNoLockedDraw(deps: ImportDeps, jobId: string, override: boolean, subEventCodes: Map<string, string>): Promise<void> {
  const rows = await deps.prisma.importRow.findMany({ where: committableWhere(jobId, override), select: { data: true } });
  const ids = [...new Set(rows.map((row) => (row.data as unknown as RowData).subEventId).filter((id): id is string => !!id))];
  const locked = await subEventsWithLockedDraw(deps.prisma, ids);
  if (locked.length && !override) {
    throw new ImportFailure(`Nội dung đã có bốc thăm, không thể import: ${locked.map((id) => subEventCodes.get(id) ?? id).join(', ')}`);
  }
}

function summarize(all: CreatedEntities[]) {
  const created = all.flatMap((item) => item.createdPlayerIds);
  const linked = new Set(all.flatMap((item) => item.playerIds).filter((id) => !created.includes(id)));
  return {
    createdPlayers: created.length,
    linkedPlayers: linked.size,
    entriesCreated: all.filter((item) => item.action === 'CREATE_ENTRY').length,
    entriesUpdated: all.filter((item) => item.action === 'UPDATE_ENTRY').length,
    createdPlayerIds: created,
    entryIds: all.map((item) => item.entryId),
  };
}

/**
 * Applies every VALID row (plus overridable ones with an ADMIN reason) in batches; safe to run again after a crash.
 * A queue job carrying an older `attemptNo` than the stored one is stale and does nothing.
 */
export async function commitImport(deps: ImportDeps, jobId: string, attemptNo?: number): Promise<CommitOutcome> {
  const job = await deps.prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'COMMITTING') return 'skipped';
  if (attemptNo !== undefined && attemptNo !== job.attemptNo) return 'skipped';
  const override = !!job.overrideReason;

  try {
    await assertFileUnchanged(deps, job);
    const [event, subEvents, codePrefix, codeDigits, countryCode, ageMethod] = await Promise.all([
      deps.prisma.event.findUniqueOrThrow({ where: { id: job.eventId }, select: { startDate: true } }),
      loadSubEventInfos(deps.prisma, job.eventId),
      readSetting(deps.prisma, playerSettings.codePrefix),
      readSetting(deps.prisma, playerSettings.codeDigits),
      readSetting(deps.prisma, playerSettings.defaultCountryCode),
      readSetting(deps.prisma, playerSettings.ageCalculation),
    ]);
    const subEventsById = new Map([...subEvents.values()].map((subEvent) => [subEvent.id, subEvent]));
    await assertNoLockedDraw(deps, jobId, override, new Map([...subEventsById].map(([id, subEvent]) => [id, subEvent.code])));

    const settings: CommitSettings = { jobId, actorId: job.createdById, overrideReason: job.overrideReason, ageMethod, codeFormat: { prefix: codePrefix, digits: codeDigits }, countryCode, eventStartDate: event.startDate, subEventsById };
    const earlier = await deps.prisma.importRow.findMany({ where: { importJobId: jobId, status: 'COMMITTED' }, select: { createdEntityIds: true } });
    const createdByKey = new Map<string, string>();
    const touchedEntries = new Set<string>();
    for (const row of earlier) {
      const entities = row.createdEntityIds as unknown as CreatedEntities;
      Object.entries(entities.newPlayerKeys ?? {}).forEach(([key, id]) => createdByKey.set(key, id));
      touchedEntries.add(entities.entryId);
    }

    const size = deps.commitBatchSize ?? BATCH_SIZE;
    let lastRowNo = 0;
    for (let batchNo = 1; ; batchNo += 1) {
      const rows = await deps.prisma.importRow.findMany({ where: { ...committableWhere(jobId, override), rowNo: { gt: lastRowNo } }, orderBy: { rowNo: 'asc' }, take: size });
      if (!rows.length) break;
      lastRowNo = rows[rows.length - 1]!.rowNo;

      const state: BatchState = { createdByKey: new Map(createdByKey), touchedEntries: new Set(touchedEntries), known: new Map(), audits: [] };
      await deps.prisma.$transaction((tx) => commitBatch(tx, rows, settings, job.eventId, state), { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS });
      state.createdByKey.forEach((id, key) => createdByKey.set(key, id));
      state.touchedEntries.forEach((id) => touchedEntries.add(id));
      await deps.onBatchCommitted?.(batchNo);
    }
    await finish(deps, jobId, job.createdById, job.overrideReason);
    return 'done';
  } catch (error) {
    if (error instanceof ImportFailure) {
      await failImportJob(deps, jobId, error.message, ['COMMITTING']);
      return 'failed';
    }
    throw error;
  }
}

async function finish(deps: ImportDeps, jobId: string, actorId: string, overrideReason: string | null): Promise<void> {
  const committed = await deps.prisma.importRow.findMany({ where: { importJobId: jobId, status: 'COMMITTED' }, select: { createdEntityIds: true } });
  const counts = await deps.prisma.importRow.groupBy({ by: ['status'], where: { importJobId: jobId }, _count: true });
  const countOf = (status: string) => counts.find((item) => item.status === status)?._count ?? 0;
  const summary = summarize(committed.map((row) => row.createdEntityIds as unknown as CreatedEntities));
  await deps.prisma.$transaction([
    deps.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        committedRows: countOf('COMMITTED'),
        validRows: countOf('VALID'),
        errorRows: countOf('ERROR'),
        needsConfirmRows: countOf('NEEDS_CONFIRM'),
        failureReason: null,
        finishedAt: (deps.now ?? (() => new Date()))(),
      },
    }),
    deps.prisma.auditLog.create({
      data: {
        actorType: 'USER',
        actorId,
        action: 'import.commit',
        entity: 'ImportJob',
        entityId: jobId,
        after: { committedRows: countOf('COMMITTED'), errorRows: countOf('ERROR'), ...summary },
        reason: overrideReason,
      },
    }),
  ]);
}
