import type { Prisma } from '@kamito/db';
import { dateFromIso } from '../../common/validation/iso-date-field.js';

type Db = Pick<Prisma.TransactionClient, 'subEvent'>;

export interface RuleImpactInput {
  competitorKind: 'SINGLES' | 'DOUBLES';
  effectiveFrom: string;
  eventTypeIds: string[];
}

/** Sub-events whose points can change: ranked, same kind and event type, and ending on or after the effective date. */
export async function findAffectedSubEvents(db: Db, input: RuleImpactInput): Promise<{ id: string; eventId: string }[]> {
  return db.subEvent.findMany({
    where: {
      rankingList: { competitorKind: input.competitorKind },
      event: { eventTypeId: { in: input.eventTypeIds }, endDate: { gte: dateFromIso(input.effectiveFrom) } },
    },
    select: { id: true, eventId: true },
    orderBy: { id: 'asc' },
  });
}
