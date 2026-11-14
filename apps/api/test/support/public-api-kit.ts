import { normalizePersonName, SSR_SECRET_HEADER } from '@kamito/shared';
import { cleanupDraws } from './draw-play-helpers.js';
import type { AuthTestKit } from './auth-test-kit.js';
import { DrawFixtureKit } from './draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './entries-fixtures.js';
import { createScoringRule, finishGroupMatches } from './group-test-helpers.js';

export const PUBLIC = '/api/v1/public';

/** Every key path in a JSON value; array elements share one `[]` segment. */
export function fieldPaths(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldPaths(item, `${prefix}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      fieldPaths(child, path, out);
    }
  }
  return out;
}

export const sortedPaths = (value: unknown) => [...fieldPaths(value)].sort();

const side = (s: string) => [s, `${s}.seed`, `${s}.quota`, `${s}.players`, `${s}.players[].name`, `${s}.players[].nameEn`, `${s}.players[].club`];

/** Match card keys without the placeholder-source sub-keys (those depend on the match, see MATCH_SOURCE_KEYS). */
export const MATCH_CARD_KEYS = [
  'matchNo', 'subEvent', 'subEvent.code', 'subEvent.name', 'subEvent.nameEn', 'drawKind', 'round', 'round.code', 'round.number',
  'groupCode', 'status', 'resultType', 'winnerSide', 'games1', 'games2', 'scheduledAt', 'voided',
  'side1Source', 'side2Source', 'games', 'games[].number', 'games[].score1', 'games[].score2',
  ...side('side1'), ...side('side2'),
];
export const MATCH_SOURCE_KEYS = ['side1Source.type', 'side1Source.matchNo', 'side2Source.type', 'side2Source.matchNo'];
export const MATCH_DETAIL_KEYS = ['event', 'event.slug', 'event.name', 'event.nameEn', 'event.timezone', 'startedAt', 'officialAt'];
export const ENTRY_ITEM_KEYS = ['seed', 'quota', 'players', 'players[].name', 'players[].nameEn', 'players[].club'];

export function publicGet(kit: AuthTestKit, secret: string, path: string) {
  return kit.http.get(`${PUBLIC}/${path}`).set(SSR_SECRET_HEADER, secret);
}

/** Legal name, contact data and display name of the player set up as "hidden" in every world. */
export function privateProfile(tag: string) {
  return {
    displayName: `Shown ${tag}`,
    legalName: `Hidden ${tag}`,
    legalNameEn: `Hidden En ${tag}`,
    phone: '0987 65 4321',
    email: `private-${tag}@example.test`,
    birthDate: new Date('1990-05-05'),
  };
}

export interface PublicWorld {
  fx: Fixtures;
  slug: string;
  tag: string;
  secret: string;
  ruleId: string;
  /** Player index → player id (see setupPublicWorld for the layout). */
  playerIds: string[];
  groupId: string;
  wsDrawId: string;
}

/**
 * One event, four sub-events:
 *  MS  published MAIN draw, 6 entries (seeds 2), player 5 withdrawn afterwards
 *  WS  published MAIN draw, 4 entries; one non-hidden round-1 match played (OFFICIAL)
 *  MD  published GROUP draw, 3 entries, all group matches finished, one group match voided
 *  WD  draft MAIN draw (not published), 5 entries (player 0 also entered here)
 * Player 6 (in WS) carries the private profile: display name shown, legal name hidden.
 */
export async function setupPublicWorld(kit: AuthTestKit, cookie: string): Promise<PublicWorld> {
  const secret = process.env.SSR_INTERNAL_SECRET!;
  const fx = await createEventFixtures(kit, cookie, ['MS', 'WS', 'MD', 'WD']);
  const slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId } })).slug;
  const sub = (code: string) => fx.subEvents[code]!;
  const players = new DrawFixtureKit(kit, cookie, fx);
  await players.addEntries(sub('MS'), 0, 6, { seeds: 2 });
  await players.addEntries(sub('WS'), 6, 4);
  await players.addEntries(sub('MD'), 10, 3);
  await players.addEntries(sub('WD'), 13, 4, { seeds: 2 });
  const playerIds = players.players.map((p) => p.id);

  const profile = privateProfile(fx.tag);
  await kit.prisma.player.update({
    where: { id: playerIds[6]! },
    data: {
      publicDisplayName: profile.displayName,
      fullName: profile.legalName,
      fullNameEn: profile.legalNameEn,
      normalizedName: normalizePersonName(profile.legalName),
      club: 'Club Six',
      phone: profile.phone,
      email: profile.email,
      birthDate: profile.birthDate,
    },
  });

  // Player 0 also has a confirmed entry in WD: must count once in event stats.
  const competitor = await kit.prisma.competitor.findFirstOrThrow({ where: { playerId: playerIds[0]! } });
  await kit.prisma.entry.create({ data: { subEventId: sub('WD'), competitorId: competitor.id, stage: 'MAIN' } });

  const generate = (code: string) => kit.write('post', `${API}/sub-events/${sub(code)}/draws`, cookie, { kind: 'MAIN', seedCount: 2 }).expect(201);
  const publish = (drawId: string, version: number) => kit.write('post', `${API}/draws/${drawId}/publish`, cookie, { expectedVersion: version }).expect(200);

  const ms = (await generate('MS')).body.data;
  await publish(ms.id, ms.version);
  await kit.prisma.entry.updateMany({ where: { subEventId: sub('MS'), competitor: { playerId: playerIds[5]! } }, data: { status: 'WITHDRAWN' } });

  const ws = (await generate('WS')).body.data;
  await publish(ws.id, ws.version);
  const p6Entry = await kit.prisma.entry.findFirstOrThrow({ where: { subEventId: sub('WS'), competitor: { playerId: playerIds[6]! } } });
  const played = await kit.prisma.match.findFirstOrThrow({
    where: {
      drawId: ws.id,
      resultType: null,
      side1EntryId: { not: null },
      side2EntryId: { not: null },
      NOT: { OR: [{ side1EntryId: p6Entry.id }, { side2EntryId: p6Entry.id }] },
    },
  });
  await kit.prisma.match.update({
    where: { id: played.id },
    data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1, games1: 3, games2: 0, games: { create: [1, 2, 3].map((number) => ({ number, score1: 11, score2: 5 })) } },
  });

  const ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
  await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
  const md = await kit.write('post', `${API}/sub-events/${sub('MD')}/draws`, cookie, { kind: 'GROUP' }).expect(201);
  await publish(md.body.data.id, 0);
  const group = await kit.prisma.group.findFirstOrThrow({ where: { drawId: md.body.data.id }, include: { members: { orderBy: { slot: 'asc' } } } });
  const members = group.members.map((m) => m.entryId);
  const cyclic = new Map([
    [`${members[0]}|${members[1]}`, members[0]!],
    [`${members[1]}|${members[2]}`, members[1]!],
    [`${members[0]}|${members[2]}`, members[2]!],
  ]);
  await finishGroupMatches(kit, group.id, (a, b) => cyclic.get(`${a}|${b}`) ?? cyclic.get(`${b}|${a}`)!);
  await kit.write('post', `${API}/groups/${group.id}/recompute`, cookie).expect(200);
  const groupMatch = await kit.prisma.match.findFirstOrThrow({ where: { groupId: group.id }, orderBy: { matchNo: 'asc' } });
  await kit.prisma.match.update({ where: { id: groupMatch.id }, data: { isVoided: true } });

  await generate('WD');
  await kit.prisma.event.update({ where: { id: fx.eventId }, data: { publishStatus: 'PUBLISHED' } });
  return { fx, slug, tag: fx.tag, secret, ruleId, playerIds, groupId: group.id, wsDrawId: ws.id };
}

export async function cleanupPublicWorld(kit: AuthTestKit, world: PublicWorld | undefined): Promise<void> {
  if (!world) return;
  await cleanupDraws(kit, Object.values(world.fx.subEvents), world.fx.eventId);
  await cleanupFixtures(kit, world.fx);
  if (world.ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: world.ruleId } });
}
