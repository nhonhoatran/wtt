import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { Prisma } from '@kamito/db';
import { normalizePersonName, tournamentSettings, type PublicSide } from '@kamito/shared';
import { publicEntryPageSql } from '../src/modules/public-competition/public-entry-page.query.js';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { publicGet } from './support/public-api-kit.js';
import { createSchedulingFixture, type SchedulingFixture } from './support/scheduling-fixtures.js';

describe('effective public player names (real Postgres)', () => {
  let kit: AuthTestKit;
  let fixture: SchedulingFixture;
  let slug: string;
  let secret: string;
  let limit: ReturnType<typeof vi.spyOn>;
  const get = (path: string) => publicGet(kit, secret, `events/${slug}/${path}`);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    const cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fixture = await createSchedulingFixture(kit, cookie);
    const event = await kit.prisma.event.update({ where: { id: fixture.fx.eventId }, data: { publishStatus: 'PUBLISHED' } });
    slug = event.slug;
    const players = await kit.prisma.player.findMany({ where: { id: { in: fixture.fx.playerIds } }, orderBy: { fullName: 'asc' } });
    const aliases = ['Ánh', 'ánh', 'Bình', 'Cường', 'Đỗ', 'Écho', 'Zulu', 'Zulu'];
    for (const [index, player] of players.entries()) {
      await kit.prisma.player.update({ where: { id: player.id }, data: {
        publicDisplayName: player.id === fixture.sharedPlayer.id ? `Đặng Ánh Đỗ ${fixture.fx.tag}` : aliases[index % aliases.length],
        club: `Sort ${index}`,
      } });
    }
    const seeded = await kit.prisma.entry.findMany({ where: { subEventId: fixture.fx.subEvents.MS! }, orderBy: { id: 'desc' }, take: 2 });
    for (const [index, entry] of seeded.entries()) await kit.prisma.entry.update({ where: { id: entry.id }, data: { seed: index + 1 } });
    const settings = kit.app.get(AppSettingsService);
    const originalGet = settings.get.bind(settings);
    // A small page makes boundary ordering visible without mutating shared development settings.
    limit = vi.spyOn(settings, 'get').mockImplementation((def) => def.key === tournamentSettings.publicListPageSize.key ? Promise.resolve(2) : originalGet(def));
  }, 180_000);

  afterAll(async () => {
    limit?.mockRestore();
    if (!kit) return;
    await fixture?.cleanup();
    await kit.close();
  }, 60_000);

  it('matches shared Unicode normalization and backfills existing players without exposing legal keys', async () => {
    for (const value of [' \uFEFFĐẶNG\t ÁNH\u00a0Đỗ\u2003 ', 'Nguyễn Đức', '한글', 'École Ångström', 'A\r\n B', '\u2028\u2029C\u205fD\u3000']) {
      const [row] = await kit.prisma.$queryRaw<{ key: string }[]>(Prisma.sql`SELECT "normalize_public_player_name"(${value}) AS key`);
      expect(row!.key).toBe(normalizePersonName(value));
    }
    const inconsistent = await kit.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) FROM "Player" WHERE "normalizedPublicName" <> "normalize_public_player_name"(COALESCE("publicDisplayName", "fullName"))
    `);
    expect(Number(inconsistent[0]!.count)).toBe(0);
  });

  it('finds accented aliases without accents including Đ/đ in singles and genuine pairs, never the hidden legal name', async () => {
    const search = async (q: string, sub: string) => (await get(`matches?state=upcoming&sub=${sub}&q=${encodeURIComponent(q)}`).expect(200)).body.data;
    for (const sub of ['MS', 'MD']) {
      const accented = await search(`ĐẶNG ÁNH ĐỖ ${fixture.fx.tag}`, sub);
      const plain = await search(`dang anh do ${fixture.fx.tag}`, sub);
      const decomposed = await search(`Đặng Ánh Đỗ ${fixture.fx.tag}`.normalize('NFD'), sub);
      expect(accented.total).toBeGreaterThan(0);
      expect(plain).toEqual(accented);
      expect(decomposed).toEqual(accented);
      expect((await search(fixture.sharedPlayer.fullName, sub)).total).toBe(0);
      expect(JSON.stringify(accented)).not.toContain(fixture.sharedPlayer.fullName);
    }
  });

  it('keeps public aliases synchronized across legal renames, alias edits and alias removal', async () => {
    const id = fixture.sharedPlayer.id;
    const before = await kit.prisma.player.findUniqueOrThrow({ where: { id } });
    try {
      let row = await kit.prisma.player.update({ where: { id }, data: { fullName: 'Hidden renamed legal', normalizedPublicName: 'cannot override this key' } });
      expect(row.normalizedPublicName).toBe(normalizePersonName(before.publicDisplayName!));
      row = await kit.prisma.player.update({ where: { id }, data: { publicDisplayName: 'Đỗ Mới' } });
      expect(row.normalizedPublicName).toBe('do moi');
      row = await kit.prisma.player.update({ where: { id }, data: { publicDisplayName: null } });
      expect(row.normalizedPublicName).toBe('hidden renamed legal');
    } finally {
      await kit.prisma.player.update({ where: { id }, data: { fullName: before.fullName, publicDisplayName: before.publicDisplayName } });
    }
  });

  for (const code of ['MS', 'MD']) it(`sorts ${code} by effective public names before pagination, with stable ties and seeds first`, async () => {
    const rows = await kit.prisma.entry.findMany({
      where: { subEventId: fixture.fx.subEvents[code]!, status: 'CONFIRMED' },
      include: { competitor: { include: { player: true, pair: { include: { playerA: true, playerB: true } } } } },
    });
    const expected = rows.map((entry) => {
      const players = entry.competitor.player ? [entry.competitor.player] : [entry.competitor.pair!.playerA, entry.competitor.pair!.playerB];
      return { id: entry.id, seed: entry.seed, key: players.map((p) => normalizePersonName(p.publicDisplayName ?? p.fullName)).join(' / '), signature: players.map((p) => `${p.publicDisplayName ?? p.fullName}|${p.club}`).join(' / ') };
    }).sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : 1));
    const read = async () => {
      const signatures: string[] = [];
      for (let page = 1; page <= Math.ceil(rows.length / 2) + 1; page++) {
        const data = (await get(`entries/${code}?page=${page}`).expect(200)).body.data;
        expect(data.total).toBe(rows.length);
        expect(data.items.length).toBe(Math.min(2, Math.max(0, rows.length - (page - 1) * 2)));
        signatures.push(...(data.items as PublicSide[]).map((side) => side.players.map((p) => `${p.name}|${p.club}`).join(' / ')));
        expect(JSON.stringify(data)).not.toContain('normalizedPublicName');
      }
      return signatures;
    };
    expect(await read()).toEqual(expected.map((row) => row.signature));
    expect(await read()).toEqual(expected.map((row) => row.signature));
    if (code === 'MS') expect(expected.some((row, index) => index > 0 && row.key === expected[index - 1]!.key)).toBe(true);
  });

  it('limits sorted entry ids in PostgreSQL and records the actual query plan', async () => {
    const sql = publicEntryPageSql(fixture.fx.subEvents.MS!, 'MAIN', 2, 2);
    const [explain] = await kit.prisma.$queryRaw<{ 'QUERY PLAN': { Plan: { 'Node Type': string; 'Actual Rows': number }; 'Execution Time': number; 'Planning Time': number }[] }[]>(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
    const result = explain!['QUERY PLAN'][0]!;
    expect(result.Plan['Node Type']).toBe('Limit');
    expect(result.Plan['Actual Rows']).toBe(2);
    const outputDir = process.env.API_TEST_ARTIFACT_DIR ?? 'test-results';
    await mkdir(outputDir, { recursive: true });
    await writeFile(`${outputDir}/public-entry-page-explain.json`, JSON.stringify({ query: 'public-entry-page', fixtureEntries: 8, plan: result }, null, 2));
  });
});
