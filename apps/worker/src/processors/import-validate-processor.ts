import { createHash } from 'node:crypto';
import type { Prisma } from '@kamito/db';
import { effectiveImportLimits, type ImportDeps } from '../import/import-deps.js';
import { failImportJob } from '../import/import-job-state.js';
import { ImportFailure, type EvaluatedRow } from '../import/import-row-types.js';
import { RowEvaluator } from '../import/row-evaluator.js';
import { loadEvaluationContext } from '../import/validation-context.js';
import { assertSafeXlsx } from '../import/xlsx-zip-guard.js';
import { readEntryRows } from '../import/xlsx-row-reader.js';

const WRITE_BATCH = 500;
const TX_TIMEOUT_MS = 120_000;

export type ValidateOutcome = 'skipped' | 'validated' | 'failed';

async function loadFile(deps: ImportDeps, fileKey: string, maxFileBytes: number, maxUnzippedBytes: number): Promise<Buffer> {
  const stat = await deps.storage.stat(fileKey);
  if (!stat) throw new ImportFailure('Không tìm thấy file đã tải lên');
  if (stat.size > maxFileBytes) throw new ImportFailure(`File vượt quá ${Math.floor(maxFileBytes / 1024 / 1024)} MB cho phép`);
  const bytes = await deps.storage.get(fileKey);
  assertSafeXlsx(bytes, maxUnzippedBytes);
  return bytes;
}

function toRowRecords(jobId: string, rows: EvaluatedRow[]): Prisma.ImportRowCreateManyInput[] {
  return rows.map((row) => ({
    importJobId: jobId,
    rowNo: row.rowNo,
    status: row.status,
    plannedAction: row.plannedAction,
    data: row.data as unknown as Prisma.InputJsonValue,
    messages: row.messages,
    candidatePlayerIds: Object.keys(row.candidates).length ? row.candidates : undefined,
  }));
}

/** Reads the uploaded workbook, classifies every row and stores the preview; the database is only read until the final write. */
export async function validateImport(deps: ImportDeps, jobId: string): Promise<ValidateOutcome> {
  const job = await deps.prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || (job.status !== 'VALIDATING' && job.status !== 'UPLOADED')) return 'skipped';
  if (job.status === 'UPLOADED') await deps.prisma.importJob.update({ where: { id: jobId }, data: { status: 'VALIDATING' } });

  try {
    const limits = await effectiveImportLimits(deps);
    const bytes = await loadFile(deps, job.fileKey, limits.maxFileBytes, limits.maxUnzippedBytes);
    const sheetRows = await readEntryRows(bytes, limits.maxRows, limits.maxUnzippedBytes);
    const context = await loadEvaluationContext(deps.prisma, job.eventId, sheetRows.map((row) => row.cells), (deps.now ?? (() => new Date()))().getFullYear());
    const evaluator = new RowEvaluator(context);
    const rows = sheetRows.map((row) => evaluator.evaluate(row.rowNo, row.cells));

    const count = (status: EvaluatedRow['status']) => rows.filter((row) => row.status === status).length;
    await deps.prisma.$transaction(
      async (tx) => {
        await tx.importRow.deleteMany({ where: { importJobId: jobId } });
        const records = toRowRecords(jobId, rows);
        for (let i = 0; i < records.length; i += WRITE_BATCH) {
          await tx.importRow.createMany({ data: records.slice(i, i + WRITE_BATCH) });
        }
        await tx.importJob.update({
          where: { id: jobId },
          data: {
            status: 'VALIDATED',
            fileSha256: createHash('sha256').update(bytes).digest('hex'),
            totalRows: rows.length,
            validRows: count('VALID'),
            errorRows: count('ERROR'),
            needsConfirmRows: count('NEEDS_CONFIRM'),
            committedRows: 0,
            failureReason: null,
            finishedAt: (deps.now ?? (() => new Date()))(),
          },
        });
      },
      { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS },
    );
    return 'validated';
  } catch (error) {
    if (error instanceof ImportFailure) {
      await failImportJob(deps, jobId, error.message);
      return 'failed';
    }
    throw error;
  }
}
