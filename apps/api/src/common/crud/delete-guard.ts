import { ConflictException } from '@nestjs/common';
import { Prisma } from '@kamito/db';

export type DependantCounts = Record<string, number>;

/** 409 the admin UI turns into "still in use, hide it instead". */
export function defaultRowConflict(): ConflictException {
  return new ConflictException({
    code: 'IS_DEFAULT',
    message: 'Không xóa được mục mặc định. Hãy chọn mục khác làm mặc định trước.',
  });
}

export function inUseConflict(dependants: DependantCounts = {}, code = 'IN_USE'): ConflictException {
  const used = Object.fromEntries(Object.entries(dependants).filter(([, count]) => count > 0));
  return new ConflictException({
    code,
    message: 'Mục này đang được sử dụng nên không xóa được. Hãy ẩn thay vì xóa.',
    dependants: used,
  });
}

/** Runs the counts one by one (they share a transaction connection) and throws 409 if any is non-zero. */
export async function assertNotInUse(counts: Record<string, () => PromiseLike<number>>): Promise<void> {
  const result: DependantCounts = {};
  for (const [name, count] of Object.entries(counts)) result[name] = await count();
  if (Object.values(result).some((value) => value > 0)) throw inUseConflict(result);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Safety net: a dependant created between the count and the delete still ends as the same 409. */
export function rethrowForeignKeyAsInUse(error: unknown): never {
  if (isForeignKeyViolation(error)) throw inUseConflict();
  throw error;
}

const DEFAULT_INDEX_MARKERS = ['isDefault', 'single_default'];

/** P2002 raised by the partial unique index that allows a single default row. */
export function isDefaultIndexViolation(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  const text = `${(error as Error).message} ${JSON.stringify((error as Prisma.PrismaClientKnownRequestError).meta ?? {})}`;
  return DEFAULT_INDEX_MARKERS.some((marker) => text.includes(marker));
}

export function defaultChangedConflict(): ConflictException {
  return new ConflictException({
    code: 'DEFAULT_CHANGED',
    message: 'Mục mặc định vừa được người khác thay đổi. Hãy tải lại rồi thử lại.',
  });
}
