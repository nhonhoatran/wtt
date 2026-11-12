import type { Prisma } from '@kamito/db';

type EventReader = Pick<Prisma.TransactionClient, 'event'>;

const MAX_STEM = 100;
const MAX_SUFFIX_TRIES = 1000;

export async function isSlugTaken(db: EventReader, slug: string, excludeId?: string): Promise<boolean> {
  const count = await db.event.count({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } });
  return count > 0;
}

/** First free `${slug}-N` (N from 2) so the form can offer a one-click fix. */
export async function suggestSlug(db: EventReader, slug: string, excludeId?: string): Promise<string> {
  const stem = slug.slice(0, MAX_STEM).replace(/-+$/, '');
  const rows = await db.event.findMany({
    where: { slug: { startsWith: `${stem}-` }, ...(excludeId && { id: { not: excludeId } }) },
    select: { slug: true },
  });
  const taken = new Set(rows.map((row) => row.slug));
  for (let n = 2; n < MAX_SUFFIX_TRIES; n += 1) {
    if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
  }
  return `${stem}-${Date.now()}`;
}
