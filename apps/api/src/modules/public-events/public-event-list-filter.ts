import { Prisma } from '@kamito/db';
import { PUBLIC_EVENT_STATUSES } from '@kamito/shared';
import { publicScope } from '../public-scope/public-scope.js';
import { parsePublicChoice, parsePublicCode, parsePublicSearch, parsePublicYear } from '../public-scope/public-query-params.js';
import type { PublicEventListQuery } from './public-events-list.query.js';

/** SQL is required for a per-row timezone date comparison before COUNT/LIMIT/OFFSET. Values remain bound parameters. */
export function publicEventListFilter(query: PublicEventListQuery, now: Date): Prisma.Sql {
  const conditions = [Prisma.sql`e."publishStatus" = ${publicScope.events.publishStatus}::"PublishStatus" AND e."isCancelled" = ${publicScope.events.isCancelled}`];
  const search = parsePublicSearch(query.q);
  if (search) {
    // Prisma contains treats LIKE metacharacters as patterns too; retain the existing search semantics.
    const pattern = `%${search.text}%`;
    conditions.push(Prisma.sql`(e.name ILIKE ${pattern} OR e."nameEn" ILIKE ${pattern} OR e."shortName" ILIKE ${pattern})`);
  }
  const tier = parsePublicCode(query.tier);
  if (tier) conditions.push(Prisma.sql`t.code = ${tier}`);
  const type = parsePublicCode(query.type);
  if (type) conditions.push(Prisma.sql`et.code = ${type}`);
  const year = parsePublicYear(query.year);
  if (year) conditions.push(Prisma.sql`e."startDate" >= ${new Date(`${year}-01-01T00:00:00Z`)} AND e."startDate" < ${new Date(`${year + 1}-01-01T00:00:00Z`)}`);
  const status = parsePublicChoice(query.status, PUBLIC_EVENT_STATUSES);
  // Intl also accepts fixed offsets (+05:30); PostgreSQL's text timezone parser reverses their sign.
  const offsetMinutes = Prisma.sql`(CASE WHEN left(e.timezone, 1) = '-' THEN -1 ELSE 1 END) * (substring(e.timezone, 2, 2)::int * 60 + CASE WHEN length(e.timezone) > 3 THEN right(e.timezone, 2)::int ELSE 0 END)`;
  const today = Prisma.sql`CASE WHEN e.timezone ~ '^[+-]' THEN (${now}::timestamptz AT TIME ZONE 'UTC' + make_interval(mins => ${offsetMinutes}))::date ELSE (${now}::timestamptz AT TIME ZONE e.timezone)::date END`;
  if (status === 'UPCOMING') conditions.push(Prisma.sql`e."startDate" > ${today}`);
  if (status === 'ONGOING') conditions.push(Prisma.sql`e."startDate" <= ${today} AND e."endDate" >= ${today}`);
  if (status === 'COMPLETED') conditions.push(Prisma.sql`e."endDate" < ${today}`);
  return Prisma.sql`FROM "Event" e JOIN "EventType" et ON et.id = e."eventTypeId" JOIN "Tier" t ON t.id = et."tierId" WHERE ${Prisma.join(conditions, ' AND ')}`;
}
