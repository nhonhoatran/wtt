import type { ImportJob } from '@kamito/db';
import { z } from 'zod';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const createImportBody = z.object({
  eventId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255).regex(/\.xlsx$/i, 'Chỉ nhận file Excel .xlsx'),
  fileSize: z.number().int().positive(),
});
export type CreateImportBody = z.infer<typeof createImportBody>;

export const decisionBody = z.object({
  slot: z.union([z.literal(1), z.literal(2)]),
  choice: z.union([z.literal('NEW'), z.string().uuid()]),
});
export type DecisionBody = z.infer<typeof decisionBody>;

export const commitBody = z.object({
  overrideReason: z.string().trim().min(5, 'Lý do tối thiểu 5 ký tự').max(500).optional(),
});
export type CommitBody = z.infer<typeof commitBody>;

export const templateQuery = z.object({ eventId: z.string().uuid() });

type JobWithEvent = ImportJob & { event: { id: string; name: string; slug: string } };

export function toImportView(job: JobWithEvent) {
  return {
    id: job.id,
    eventId: job.eventId,
    event: { id: job.event.id, name: job.event.name, slug: job.event.slug },
    fileName: job.fileName,
    fileSize: job.fileSize,
    status: job.status,
    failureReason: job.failureReason,
    totalRows: job.totalRows,
    validRows: job.validRows,
    errorRows: job.errorRows,
    needsConfirmRows: job.needsConfirmRows,
    committedRows: job.committedRows,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    createdById: job.createdById,
  };
}
