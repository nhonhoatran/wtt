import type { ImportStatus } from '@kamito/db';
import type { ImportDeps } from './import-deps.js';

export const GENERIC_FAILURE = 'Lỗi xử lý file, hãy thử lại hoặc liên hệ quản trị viên';

/** Marks the job FAILED unless it already reached a final state. */
export async function failImportJob(deps: ImportDeps, jobId: string, reason: string, from: ImportStatus[] = ['VALIDATING', 'COMMITTING', 'UPLOADED']): Promise<boolean> {
  const now = (deps.now ?? (() => new Date()))();
  const result = await deps.prisma.importJob.updateMany({
    where: { id: jobId, status: { in: from } },
    data: { status: 'FAILED', failureReason: reason, finishedAt: now },
  });
  return result.count > 0;
}
