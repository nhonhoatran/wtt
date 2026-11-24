import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SSR_SECRET_HEADER, type PublicRankingList } from '@kamito/shared';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupRankingWorld, createRankingWorld, type RankingWorld } from './support/ranking-test-kit.js';

const PAGE_ROWS = 50;
const RESULTS_PER_PLAYER = 20;
const WIRE_BUDGET_BYTES = 80 * 1024;

function readHttp(url: URL, headers: Record<string, string>) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; bytes: Buffer }>((resolve, reject) => {
    http.get(url, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, bytes: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

describe('public ranking payload with dense immutable breakdowns (real HTTP and Postgres)', () => {
  let kit: AuthTestKit;
  let world: RankingWorld;
  let address: AddressInfo;
  const extraEventIds: string[] = [];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    world = await createRankingWorld(kit);
    const { prisma } = kit;
    const events = Array.from({ length: RESULTS_PER_PLAYER }, (_, index) => ({
      id: randomUUID(),
      slug: `payload-${world.tag}-${index}`,
      name: `Giải bóng bàn mở rộng tỉnh và các câu lạc bộ khu vực lần ${index + 1} năm 2099 ${world.tag}`,
      nameEn: `Regional open table tennis championships for provincial clubs edition ${index + 1} in 2099 ${world.tag}`,
      eventTypeId: world.eventTypeId,
      startDate: new Date('2099-05-01'),
      endDate: new Date('2099-05-02'),
      timezone: 'Asia/Ho_Chi_Minh',
      publishStatus: 'PUBLISHED' as const,
    }));
    extraEventIds.push(...events.map((event) => event.id));
    await prisma.event.createMany({ data: events });
    const players = Array.from({ length: PAGE_ROWS }, (_, index) => ({
      id: randomUUID(), code: `PL-${world.tag}-${index}`, slug: `payload-player-${world.tag}-${index}`,
      fullName: `Vận động viên ${world.tag} ${index + 1}`, fullNameEn: `Player ${world.tag} ${index + 1}`,
      normalizedName: `van dong vien ${world.tag} ${index + 1}`, club: `Câu lạc bộ bóng bàn ${world.tag} ${index % 5}`,
      gender: 'MALE' as const, countryCode: 'VIE',
    }));
    world.playerIds.push(...players.map((player) => player.id));
    await prisma.player.createMany({ data: players });
    const snapshot = await prisma.rankingSnapshot.create({ data: { rankingListId: world.listId, asOfDate: new Date('2099-06-01') } });
    await prisma.rankingSnapshotRow.createMany({ data: players.map((player, index) => {
      const breakdown = events.map((event, eventIndex) => ({
        ledgerId: `${world.tag}-${index}-${eventIndex}`,
        eventId: event.id, eventSlug: event.slug, eventName: event.name, eventNameEn: event.nameEn,
        eventTypeCode: `RE-${world.tag}`, stageCode: eventIndex % 2 === 0 ? 'W' : 'F',
        points: 1000 - eventIndex * 10 - index, earnedAt: '2099-05-02', expiresAt: '2100-05-02',
      }));
      return { snapshotId: snapshot.id, playerId: player.id, rank: index + 1, previousRank: index + 2, movement: 1,
        points: breakdown.reduce((sum, item) => sum + item.points, 0), resultsCounted: breakdown.length, breakdown };
    }) });
    await prisma.rankingSnapshot.update({ where: { id: snapshot.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await kit.app.listen(0, '127.0.0.1');
    address = kit.app.getHttpServer().address() as AddressInfo;
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    try {
      if (extraEventIds.length) await kit.prisma.event.deleteMany({ where: { id: { in: extraEventIds } } });
      if (world) await cleanupRankingWorld(kit, [world]);
    } finally { await kit.close(); }
  }, 60_000);

  it('keeps all 1,000 breakdown records and fits the gzip transfer budget while recording the larger raw response', async () => {
    const url = new URL(`http://127.0.0.1:${address.port}/api/v1/public/rankings/RL-${world.tag}?pageSize=${PAGE_ROWS}`);
    const headers = { [SSR_SECRET_HEADER]: process.env.SSR_INTERNAL_SECRET! };
    const raw = await readHttp(url, { ...headers, 'accept-encoding': 'identity' });
    const gzip = await readHttp(url, { ...headers, 'accept-encoding': 'gzip' });
    expect(raw.status).toBe(200);
    expect(gzip.status).toBe(200);
    expect(gzip.headers['content-encoding']).toBe('gzip');
    expect(gzip.headers.vary?.toLowerCase()).toContain('accept-encoding');
    const decoded = gunzipSync(gzip.bytes);
    const data = JSON.parse(decoded.toString('utf8')) as { data: PublicRankingList };
    expect(data.data.items).toHaveLength(PAGE_ROWS);
    expect(data.data.items.every((item) => item.breakdown.length === RESULTS_PER_PLAYER)).toBe(true);
    expect(data.data.items.every((item) => item.points === item.breakdown.reduce((sum, result) => sum + result.points, 0))).toBe(true);
    expect(JSON.parse(decoded.toString('utf8'))).toEqual(JSON.parse(raw.bytes.toString('utf8')));
    expect(raw.bytes.length).toBeGreaterThan(WIRE_BUDGET_BYTES);
    expect(gzip.bytes.length).toBeLessThanOrEqual(WIRE_BUDGET_BYTES);
    const outputDir = process.env.API_TEST_ARTIFACT_DIR ?? 'test-results';
    await mkdir(outputDir, { recursive: true });
    await writeFile(`${outputDir}/public-ranking-payload-budget.json`, JSON.stringify({
      rows: PAGE_ROWS, resultsPerPlayer: RESULTS_PER_PLAYER, breakdownRecords: PAGE_ROWS * RESULTS_PER_PLAYER,
      rawBytes: raw.bytes.length, gzipBytes: gzip.bytes.length, wireBudgetBytes: WIRE_BUDGET_BYTES,
      rawBudgetMet: raw.bytes.length <= WIRE_BUDGET_BYTES, gzipBudgetMet: gzip.bytes.length <= WIRE_BUDGET_BYTES,
    }, null, 2));
  });
});
