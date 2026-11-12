import type { MediaProcessorDeps } from './media-image-processor.js';

export type Row = Record<string, unknown> & { id: string; status: string; incomingKey: string; purpose: string; expiresAt: Date };

/** Minimal in-memory stand-in for prisma.mediaAsset; the e2e spec covers the real database. */
export function fakePrisma(rows: Row[]) {
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, cond]) =>
      cond && typeof cond === 'object' && 'lt' in cond ? (row[key] as Date) < (cond as { lt: Date }).lt : row[key] === cond,
    );
  return {
    mediaAsset: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = rows.filter((row) => matches(row, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      },
    },
  } as unknown as MediaProcessorDeps['prisma'];
}
