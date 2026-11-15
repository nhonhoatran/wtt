import type { AuthTestKit } from '../support/auth-test-kit.js';
import { DrawFixtureKit } from '../support/draw-fixtures.js';
import { API, createEventFixtures, type Fixtures } from '../support/entries-fixtures.js';

export interface LongEventFixture {
  fixture: Fixtures;
  slug: string;
  firstDate: string;
  lastDate: string;
  lateDate: string;
  matchNo: number;
}

/** An ongoing event whose sole public match is upcoming, beyond the former 62-day date-option limit. */
export async function createLongEventFixture(kit: AuthTestKit, cookie: string): Promise<LongEventFixture> {
  const fixture = await createEventFixtures(kit, cookie, ['MS']);
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const firstDate = day(-100);
  const lastDate = day(100);
  const lateDate = day(20);
  const event = await kit.prisma.event.update({
    where: { id: fixture.eventId },
    data: { startDate: new Date(firstDate), endDate: new Date(lastDate), timezone: 'UTC', publishStatus: 'PUBLISHED' },
  });
  const entries = new DrawFixtureKit(kit, cookie, fixture);
  await entries.addEntries(fixture.subEvents.MS!, 0, 2);
  const draw = (await kit.write('post', `${API}/sub-events/${fixture.subEvents.MS!}/draws`, cookie, { kind: 'MAIN', seedCount: 0 }).expect(201)).body.data;
  await kit.write('post', `${API}/draws/${draw.id}/publish`, cookie, { expectedVersion: draw.version }).expect(200);
  const match = await kit.prisma.match.findFirstOrThrow({ where: { drawId: draw.id, resultType: null } });
  await kit.prisma.match.update({ where: { id: match.id }, data: { scheduledAt: new Date(`${lateDate}T08:00:00Z`) } });
  return { fixture, slug: event.slug, firstDate, lastDate, lateDate, matchNo: match.matchNo };
}
