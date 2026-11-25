import type { Prisma } from '@kamito/db';

const publishedEvent = { publishStatus: 'PUBLISHED', isCancelled: false } satisfies Prisma.EventWhereInput;
const publishedDraw = { status: 'PUBLISHED' } satisfies Prisma.DrawWhereInput;

// `resultType <> 'BYE'` alone is NULL (so false) for unplayed matches in SQL.
const publicMatchRows = {
  draw: publishedDraw,
  OR: [{ resultType: null }, { resultType: { not: 'BYE' } }],
} satisfies Prisma.MatchWhereInput;

const publicMatchIn = (event: Prisma.EventWhereInput): Prisma.MatchWhereInput => ({
  event: { ...event, ...publishedEvent },
  ...publicMatchRows,
});

/**
 * The one definition of what the public site may see. Every public query builds its `where` from here,
 * so a draft or cancelled event or a draft draw never leaks through a new endpoint.
 * Bracket and match sides keep a withdrawn entry on purpose: it is the loser of the walkover shown there.
 */
export const publicScope = {
  events: publishedEvent,
  event: (slug: string): Prisma.EventWhereInput => ({ slug, ...publishedEvent }),
  draw: publishedDraw,
  entry: { status: 'CONFIRMED' } satisfies Prisma.EntryWhereInput,
  /** Real (non-BYE) matches of published draws of a public event. */
  /** Same rule for a relation already scoped to a public event (e.g. `_count.matches`). */
  matchOfEvent: publicMatchRows,
  match: (slug: string): Prisma.MatchWhereInput => publicMatchIn({ slug }),
  matchIn: (event: Prisma.EventWhereInput): Prisma.MatchWhereInput => publicMatchIn(event),
} as const;
