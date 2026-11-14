import { importOperationalSettings, importSettings } from '@kamito/shared';
import type { ImportDeps } from '../import/import-deps.js';
import { readSetting } from '../read-setting.js';

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const UPLOAD_EXPIRED_REASON = 'Hết hạn tải file';

/** Deletes stored workbooks older than the retention setting and expires uploads nobody finished. */
export async function cleanupImportFiles(deps: ImportDeps): Promise<{ deleted: number; expired: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const [retentionDays, uploadTtlHours] = await Promise.all([
    readSetting(deps.prisma, importSettings.retentionDays),
    readSetting(deps.prisma, importOperationalSettings.uploadTtlHours),
  ]);

  const stale = await deps.prisma.importJob.findMany({
    where: { createdAt: { lt: new Date(now.getTime() - retentionDays * DAY_MS) }, fileDeletedAt: null, status: { notIn: ['VALIDATING', 'COMMITTING'] } },
    select: { id: true, fileKey: true },
    take: BATCH_SIZE,
  });
  let deleted = 0;
  for (const job of stale) {
    if (!(await removeFile(deps, job.fileKey))) continue;
    await deps.prisma.importJob.update({ where: { id: job.id }, data: { fileDeletedAt: now } });
    deleted += 1;
  }

  const abandoned = await deps.prisma.importJob.findMany({
    where: { status: 'AWAITING_UPLOAD', createdAt: { lt: new Date(now.getTime() - uploadTtlHours * HOUR_MS) } },
    select: { id: true, fileKey: true },
    take: BATCH_SIZE,
  });
  let expired = 0;
  for (const job of abandoned) {
    if (!(await removeFile(deps, job.fileKey))) continue;
    const result = await deps.prisma.importJob.updateMany({
      where: { id: job.id, status: 'AWAITING_UPLOAD' },
      data: { status: 'FAILED', failureReason: UPLOAD_EXPIRED_REASON, fileDeletedAt: now, finishedAt: now },
    });
    expired += result.count;
  }
  return { deleted, expired };
}

/** A missing file counts as removed; a storage error leaves the job untouched so the next run retries it. */
async function removeFile(deps: ImportDeps, key: string): Promise<boolean> {
  try {
    await deps.storage.delete(key);
    return true;
  } catch {
    return false;
  }
}
