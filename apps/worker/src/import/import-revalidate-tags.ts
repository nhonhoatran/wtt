import type { PrismaClient } from '@kamito/db';
import { entryChangeTags, isValidCacheTag } from '@kamito/shared';
import type { CreatedEntities } from './commit-types.js';
import type { ImportDeps } from './import-deps.js';

export async function importRevalidateTags(prisma: PrismaClient, eventId: string, committed: CreatedEntities[]): Promise<string[]> {
  if (!committed.length) return [];
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } });
  if (!event) return [];
  const entryIds = [...new Set(committed.map((item) => item.entryId))];
  const playerIds = [...new Set(committed.flatMap((item) => item.playerIds))];
  const [entries, players] = await Promise.all([
    prisma.entry.findMany({ where: { id: { in: entryIds } }, distinct: ['subEventId'], select: { subEvent: { select: { code: true } } } }),
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { slug: true } }),
  ]);
  const tags = entryChangeTags({
    eventSlug: event.slug,
    subEventCodes: entries.map((entry) => entry.subEvent.code),
    playerSlugs: players.map((player) => player.slug),
    includePlayersList: true,
  });
  return tags.filter(isValidCacheTag);
}

/** The import is already committed, so a failure here is only logged; the pages then refresh on their own TTL. */
export async function refreshPublicAfterImport(deps: ImportDeps, jobId: string, eventId: string, committed: CreatedEntities[]): Promise<void> {
  if (!deps.enqueueRevalidate) return;
  try {
    const tags = await importRevalidateTags(deps.prisma, eventId, committed);
    if (tags.length) await deps.enqueueRevalidate(tags);
  } catch (error) {
    deps.logger?.warn({ importJobId: jobId, err: (error as Error).message }, 'import revalidate enqueue failed, public pages refresh on their TTL');
  }
}
