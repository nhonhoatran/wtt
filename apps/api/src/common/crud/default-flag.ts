import type { Prisma } from '@kamito/db';
import { fieldError } from '../validation/parse-body.js';

interface DefaultCapableDelegate {
  count(args: { where: { isDefault: boolean } }): PromiseLike<number>;
  updateMany(args: { where: Record<string, unknown>; data: { isDefault: boolean } }): PromiseLike<unknown>;
}

interface DefaultInput {
  isDefault?: boolean;
  isActive?: boolean;
}

interface DefaultRow {
  id: string;
  isDefault: boolean;
  isActive: boolean;
}

/** Serialises every write that can change which row is the default; held until the transaction ends. */
export async function lockDefault(tx: Prisma.TransactionClient, lockName: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockName}))`;
}

const UNSET_ERROR = 'Phải có đúng một mục mặc định. Hãy chọn mục khác làm mặc định.';

/**
 * Keeps exactly one default row. Call inside the write transaction; returns the isDefault value to store
 * (undefined = leave unchanged). Setting a new default unsets the old one; the first row becomes default.
 */
export async function resolveDefaultFlag(
  tx: Prisma.TransactionClient,
  lockName: string,
  delegate: DefaultCapableDelegate,
  input: DefaultInput,
  existing: DefaultRow | null,
): Promise<boolean | undefined> {
  const active = input.isActive ?? existing?.isActive ?? true;
  await lockDefault(tx, lockName);

  if (existing?.isDefault && input.isDefault === false) throw fieldError('isDefault', UNSET_ERROR);
  if (existing?.isDefault && !active) throw fieldError('isActive', 'Không ẩn được mục mặc định. Hãy chọn mục khác làm mặc định trước.');

  if (input.isDefault === true) {
    if (!active) throw fieldError('isActive', 'Mục mặc định phải đang hiện');
    await delegate.updateMany({ where: { isDefault: true, ...(existing && { NOT: { id: existing.id } }) }, data: { isDefault: false } });
    return true;
  }
  if (!existing && active && (await delegate.count({ where: { isDefault: true } })) === 0) return true;
  return input.isDefault;
}
