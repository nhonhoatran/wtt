import { isRetryableDbConflict } from '../../common/filters/http-exception.filter.js';

/** Raw FOR UPDATE queries use P2010 with the pg adapter's structured cause instead of Prisma P2034. */
export function isAutoScheduleWriteConflict(error: unknown): boolean {
  if (isRetryableDbConflict(error)) return true;
  const cause = (error as { meta?: { driverAdapterError?: { cause?: { kind?: string; originalCode?: string } } } } | null)?.meta?.driverAdapterError?.cause;
  return cause?.kind === 'TransactionWriteConflict' || cause?.originalCode === '40001' || cause?.originalCode === '40P01';
}
