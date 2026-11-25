import type { Prisma } from '@kamito/db';

interface SessionLabels {
  code: string;
  name: string | null;
  nameEn: string | null;
}

export const sessionRelabeled = (before: SessionLabels, after: SessionLabels): boolean =>
  before.code !== after.code || before.name !== after.name || before.nameEn !== after.nameEn;

/** Match pages show the session label, so a rename touches every match in the session; a retime only the retimed ones. */
export async function sessionMatchNosToRefresh(
  db: Pick<Prisma.TransactionClient, 'match'>,
  sessionId: string,
  relabeled: boolean,
  retimed: number[],
): Promise<number[]> {
  if (!relabeled) return retimed;
  const rows = await db.match.findMany({ where: { sessionId }, select: { matchNo: true } });
  return [...new Set([...retimed, ...rows.map((r) => r.matchNo)])];
}
