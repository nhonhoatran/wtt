import type { Prisma } from '@kamito/db';
import { publicPlayerSlug } from '@kamito/shared';
import type { DrawTagContext } from '../revalidation/cache-tags.js';
import { loadPlayerIdsOfEntries } from '../revalidation/public-tag-context.js';

type Db = Prisma.TransactionClient;

export interface DrawTagOptions {
  /** `draw`: matches of this draw. `subEvent`: also the sibling QUALIFYING/MAIN draw, which a withdrawal can cascade into. Omit when match pages are unaffected. */
  matches?: 'draw' | 'subEvent';
  /** Entries whose players' pages change (replaced, replacing or withdrawn). */
  entryIds?: string[];
}

export async function loadDrawTagContext(db: Db, drawId: string, options: DrawTagOptions = {}): Promise<DrawTagContext> {
  const draw = await db.draw.findUniqueOrThrow({
    where: { id: drawId },
    select: { kind: true, subEventId: true, subEvent: { select: { code: true, event: { select: { slug: true } } } } },
  });
  const context: DrawTagContext = { eventSlug: draw.subEvent.event.slug, subEventCode: draw.subEvent.code, hasGroups: draw.kind === 'GROUP' };
  if (options.matches) {
    const rows = await db.match.findMany({
      where: options.matches === 'draw' ? { drawId } : { subEventId: draw.subEventId },
      select: { matchNo: true },
    });
    context.matchNos = rows.map((row) => row.matchNo);
  }
  if (options.entryIds?.length) {
    const playerIds = await loadPlayerIdsOfEntries(db, options.entryIds);
    const players = await db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, slug: true } });
    context.playerSlugs = players.flatMap((player) => [player.slug, publicPlayerSlug(player.id)]);
  }
  return context;
}

/** Tags for placing entries into a PUBLISHED draw: the matches those entries now sit in and their players' pages. */
export async function loadPlacementTagContext(db: Db, drawId: string, entryIds: string[]): Promise<DrawTagContext> {
  const context = await loadDrawTagContext(db, drawId, { entryIds });
  const rows = await db.match.findMany({
    where: { drawId, OR: [{ side1EntryId: { in: entryIds } }, { side2EntryId: { in: entryIds } }] },
    select: { matchNo: true },
  });
  context.matchNos = rows.map((row) => row.matchNo);
  return context;
}
