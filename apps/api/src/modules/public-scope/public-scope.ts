import type { Prisma } from '@kamito/db';

/**
 * The one definition of what the public site may see. Every public query builds its `where` from here,
 * so a draft or cancelled event or a draft draw never leaks through a new endpoint.
 * Bracket sides keep a withdrawn entry on purpose: it is the loser of the walkover shown in that match.
 */
export const publicScope = {
  event: (slug: string): Prisma.EventWhereInput => ({ slug, publishStatus: 'PUBLISHED', isCancelled: false }),
  draw: { status: 'PUBLISHED' } satisfies Prisma.DrawWhereInput,
} as const;
