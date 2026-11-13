import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SSR_SECRET_HEADER } from '@kamito/shared';
import { SsrInternalGuard } from '../src/common/guards/ssr-internal.guard.js';
import { RevalidationEnqueueService } from '../src/modules/revalidation/revalidation-enqueue.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';

const PUBLIC = '/api/v1/public';

/** Every key path in a JSON value; array elements share one `[]` segment. */
function fieldPaths(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
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

const SIDE_FIELDS = (side: string) => [side, `${side}.seed`, `${side}.quota`, `${side}.players`, `${side}.players[].name`, `${side}.players[].nameEn`, `${side}.players[].club`];
const M = 'sections[].rounds[].matches[]';

/** Changing this list is a deliberate decision about what the public site exposes. */
const EXPECTED_FIELDS = [
  'event', 'event.slug', 'event.name', 'event.nameEn', 'event.timezone',
  'subEvent', 'subEvent.code', 'subEvent.name', 'subEvent.nameEn',
  'draw', 'draw.kind', 'draw.size', 'draw.publishedAt',
  'availableKinds',
  'sections', 'sections[].section', 'sections[].rounds', 'sections[].rounds[].code', 'sections[].rounds[].number', 'sections[].rounds[].matches',
  ...['matchNo', 'orderInRound', 'status', 'resultType', 'winnerSide', 'games1', 'games2', 'scheduledAt', 'games', 'games[].number', 'games[].score1', 'games[].score2'].map((f) => `${M}.${f}`),
  ...SIDE_FIELDS(`${M}.side1`), ...SIDE_FIELDS(`${M}.side2`),
  ...['side1Source', 'side1Source.type', 'side1Source.matchNo', 'side2Source', 'side2Source.type', 'side2Source.matchNo'].map((f) => `${M}.${f}`),
].sort();

describe('public bracket API (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let fx: Fixtures;
  let slug: string;
  let secret: string;
  let hiddenLegalName: string;

  const sub = (code: string) => fx.subEvents[code]!;
  const bracket = (path: string, header: string | null = secret) => {
    const req = kit.http.get(`${PUBLIC}/events/${path}`);
    return header === null ? req : req.set(SSR_SECRET_HEADER, header);
  };
  const expectHidden = async (path: string) => expect((await bracket(path).expect(200)).body).toEqual({ data: null });
  const generate = (code: string) => kit.write('post', `${API}/sub-events/${sub(code)}/draws`, adminCookie, { kind: 'MAIN', seedCount: 2 }).expect(201);
  const setEvent = (data: { publishStatus?: 'DRAFT' | 'PUBLISHED'; isCancelled?: boolean }) => kit.prisma.event.update({ where: { id: fx.eventId }, data });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS']);
    slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId } })).slug;
    const players = new DrawFixtureKit(kit, adminCookie, fx);
    await players.addEntries(sub('MS'), 0, 6, { seeds: 2 });
    await players.addEntries(sub('WS'), 6, 4);
    hiddenLegalName = players.players[0]!.fullName;
    await kit.prisma.player.update({ where: { id: players.players[0]!.id }, data: { publicDisplayName: 'Display Zero', fullNameEn: 'Legal Zero' } });
    await kit.prisma.player.update({ where: { id: players.players[1]!.id }, data: { fullNameEn: `English One ${fx.tag}`, club: 'Club One' } });

    const ms = (await generate('MS')).body.data;
    await kit.write('post', `${API}/draws/${ms.id}/publish`, adminCookie, { expectedVersion: ms.version }).expect(200);
    await generate('WS');
    const played = await kit.prisma.match.findFirstOrThrow({ where: { drawId: ms.id, resultType: null, side1EntryId: { not: null }, side2EntryId: { not: null } } });
    await kit.prisma.match.update({
      where: { id: played.id },
      data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1, games1: 3, games2: 0, games: { create: [1, 2, 3].map((number) => ({ number, score1: 11, score2: 5 })) } },
    });
    await setEvent({ publishStatus: 'PUBLISHED' });
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    await kit.close();
  }, 60_000);

  it('answers only requests carrying the SSR secret', async () => {
    await bracket(`${slug}/draws/MS`, null).expect(403);
    await bracket(`${slug}/draws/MS`, 'wrong-secret').expect(403);
    await bracket(`${slug}/draws/MS`, `${secret}x`).expect(403);
  });

  it('guards every /public controller with SsrInternalGuard', () => {
    const controllers = [...kit.app.get(ModulesContainer).values()].flatMap((m) => [...m.controllers.values()].map((w) => w.metatype));
    const publicOnes = controllers.filter((c) => c && String(Reflect.getMetadata(PATH_METADATA, c)).startsWith('public'));
    expect(publicOnes.length).toBeGreaterThan(0);
    for (const c of publicOnes) expect(Reflect.getMetadata(GUARDS_METADATA, c!)).toContain(SsrInternalGuard);
  });

  it('serves a published draw with sections, BYEs, placeholders and played games', async () => {
    const { data } = (await bracket(`${slug}/draws/MS`).expect(200)).body;
    expect(data.event.slug).toBe(slug);
    expect(data.draw).toMatchObject({ kind: 'MAIN', size: 8 });
    expect(data.availableKinds).toEqual(['MAIN']);
    const matches = data.sections.flatMap((s: { rounds: { matches: unknown[] }[] }) => s.rounds.flatMap((r) => r.matches));
    expect(matches).toHaveLength(7);
    expect(matches.filter((m: { resultType: string }) => m.resultType === 'BYE')).toHaveLength(2);
    expect(matches.some((m: { side1Source: { type: string } | null }) => m.side1Source?.type === 'WINNER_OF')).toBe(true);
    const played = matches.find((m: { games: unknown[] }) => m.games.length === 3);
    expect(played).toMatchObject({ status: 'OFFICIAL', games1: 3, games2: 0, winnerSide: 1 });
  });

  it('uses the display name instead of both legal names', async () => {
    const text = JSON.stringify((await bracket(`${slug}/draws/MS`).expect(200)).body.data);
    expect(text).toContain('Display Zero');
    expect(text).not.toContain('Legal Zero');
    expect(text).not.toContain(hiddenLegalName);
    expect(text).toContain(`English One ${fx.tag}`);
  });

  it('serializes exactly the whitelisted fields', async () => {
    const { data } = (await bracket(`${slug}/draws/MS`).expect(200)).body;
    expect([...fieldPaths(data)].sort()).toEqual(EXPECTED_FIELDS);
  });

  // 200 + null (not 404) so the client's fetch cache replaces a page that was taken down.
  it('hides draft draws, unknown kinds and unknown codes', async () => {
    await expectHidden(`${slug}/draws/WS`);
    await expectHidden(`${slug}/draws/MS?kind=qualifying`);
    await expectHidden(`${slug}/draws/MS?kind=toString`);
    await expectHidden(`${slug}/draws/MS?kind=main&kind=qualifying`);
    await expectHidden(`${slug}/draws/XX`);
    await expectHidden(`no-such-${fx.tag}/draws/MS`);
  });

  it('hides the whole event while it is a draft or cancelled', async () => {
    await setEvent({ publishStatus: 'DRAFT' });
    await expectHidden(`${slug}/draws/MS`);
    await setEvent({ publishStatus: 'PUBLISHED', isCancelled: true });
    await expectHidden(`${slug}/draws/MS`);
    await setEvent({ isCancelled: false });
    expect((await bracket(`${slug}/draws/MS`).expect(200)).body.data).not.toBeNull();
  });

  it('hides a draw once it is unpublished and queues its cache tags', async () => {
    const draft = await kit.prisma.draw.findFirstOrThrow({ where: { subEventId: sub('WS'), kind: 'MAIN' } });
    await kit.write('post', `${API}/draws/${draft.id}/publish`, adminCookie, { expectedVersion: draft.version }).expect(200);
    expect((await bracket(`${slug}/draws/WS`).expect(200)).body.data).not.toBeNull();

    const enqueue = vi.spyOn(kit.app.get(RevalidationEnqueueService), 'enqueue');
    const published = await kit.prisma.draw.findUniqueOrThrow({ where: { id: draft.id } });
    await kit.write('post', `${API}/draws/${draft.id}/unpublish`, adminCookie, { expectedVersion: published.version, reason: 'test' }).expect(200);
    await expectHidden(`${slug}/draws/WS`);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]()).toContain(`draw-${slug}-WS`);
    enqueue.mockRestore();
  });
});
