import type { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';

/** Pinned public event, else the first featured current event, else the first current event. */
export async function resolveHeroEventSlug(
  prisma: PrismaService,
  pinnedEventId: string | null,
  featured: { slug: string }[],
  upcoming: { slug: string }[],
): Promise<string | null> {
  if (pinnedEventId) {
    const pinned = await prisma.event.findFirst({ where: { ...publicScope.events, id: pinnedEventId }, select: { slug: true } });
    if (pinned) return pinned.slug;
  }
  return featured[0]?.slug ?? upcoming[0]?.slug ?? null;
}
