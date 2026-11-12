import { randomUUID } from 'node:crypto';
import type { AuthTestKit } from './auth-test-kit.js';

export const API = '/api/v1/admin';

export interface Fixtures {
  eventId: string;
  subEvents: Record<string, string>;
  playerIds: string[];
  tag: string;
}

/** Event (far future) with one sub-event per discipline code; qualifying enabled on all of them. */
export async function createEventFixtures(kit: AuthTestKit, adminCookie: string, codes = ['MS', 'WS', 'MD', 'WD', 'XD']): Promise<Fixtures> {
  const tag = randomUUID().slice(0, 6);
  const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
  const created = await kit.write('post', `${API}/events`, adminCookie, {
    name: `Entries ${tag}`,
    eventTypeId: eventType.id,
    startDate: '2099-05-01',
    endDate: '2099-05-02',
  });
  if (created.status !== 201) throw new Error(`event create failed: ${JSON.stringify(created.body)}`);
  const eventId = created.body.data.id as string;
  const disciplines = await kit.prisma.discipline.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const bulk = await kit.write('post', `${API}/events/${eventId}/sub-events/bulk`, adminCookie, {
    items: disciplines.map((row) => ({ disciplineId: row.id })),
    defaults: { format: 'KNOCKOUT', hasQualifying: true },
  });
  if (bulk.status !== 201) throw new Error(`sub-event bulk failed: ${JSON.stringify(bulk.body)}`);
  const subEvents = Object.fromEntries((bulk.body.data as { id: string; code: string }[]).map((row) => [row.code, row.id]));
  return { eventId, subEvents, playerIds: [], tag };
}

export async function createPlayer(
  kit: AuthTestKit,
  cookie: string,
  fixtures: Fixtures,
  body: { fullName: string; gender: 'MALE' | 'FEMALE'; birthYear?: number; birthDate?: string; club?: string },
): Promise<{ id: string; code: string; slug: string; fullName: string }> {
  const res = await kit.write('post', `${API}/players`, cookie, { birthYear: 2000, ...body });
  if (res.status !== 201) throw new Error(`player create failed: ${res.status} ${JSON.stringify(res.body)}`);
  fixtures.playerIds.push(res.body.data.id);
  return res.body.data;
}

/** entries -> competitors -> pairs -> players, plus the audit rows they produced. */
export async function cleanupFixtures(kit: AuthTestKit, fixtures: Fixtures | undefined, extraEntityIds: string[] = []): Promise<void> {
  if (!fixtures) return;
  const { prisma } = kit;
  const subEventIds = Object.values(fixtures.subEvents);
  const extraSubEvents = await prisma.subEvent.findMany({ where: { eventId: fixtures.eventId }, select: { id: true } });
  const allSubEventIds = [...new Set([...subEventIds, ...extraSubEvents.map((row) => row.id)])];
  const entries = await prisma.entry.findMany({ where: { subEventId: { in: allSubEventIds } }, select: { id: true } });
  const playerIds = fixtures.playerIds;
  const pairs = await prisma.pair.findMany({
    where: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] },
    select: { id: true },
  });
  const entityIds = [fixtures.eventId, ...allSubEventIds, ...entries.map((row) => row.id), ...playerIds, ...pairs.map((row) => row.id), ...extraEntityIds];
  await prisma.entry.deleteMany({ where: { subEventId: { in: allSubEventIds } } });
  await prisma.competitor.deleteMany({
    where: { OR: [{ playerId: { in: playerIds } }, { pairId: { in: pairs.map((row) => row.id) } }] },
  });
  await prisma.pair.deleteMany({ where: { id: { in: pairs.map((row) => row.id) } } });
  await prisma.player.updateMany({ where: { id: { in: playerIds } }, data: { mergedIntoId: null } });
  await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  await prisma.event.deleteMany({ where: { id: fixtures.eventId } });
}
