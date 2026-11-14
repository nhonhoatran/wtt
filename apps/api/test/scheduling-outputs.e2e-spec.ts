import { randomUUID } from 'node:crypto';
import { Queue, type Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, SESSION_DATE, type SchedulingFixture } from './support/scheduling-fixtures.js';

const binary = (res: NodeJS.ReadableStream, done: (error: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

describe('match sheets, exports and public refresh of the schedule (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  let sf: SchedulingFixture;
  let sessionId: string;
  let slug: string;
  const queue = new Queue('revalidate', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });

  const queuedTags = async (since: number) => {
    const jobs: Job[] = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    return new Set(jobs.filter((job) => job.timestamp >= since).flatMap((job) => job.data.tags as string[]));
  };
  const pause = () => new Promise((resolve) => setTimeout(resolve, 5));
  const download = async (url: string, cookie = admin) => {
    const res = await kit.http.get(url).set('Cookie', cookie).buffer(true).parse(binary as never).expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as never);
    return { res, sheet: workbook.worksheets[0]! };
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    sf = await createSchedulingFixture(kit, admin);
    slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: sf.fx.eventId }, select: { slug: true } })).slug;
    const [t1, t2] = sf.tableIds;
    const created = await kit.write('post', `${API}/events/${sf.fx.eventId}/sessions`, admin, { date: SESSION_DATE, code: 'S01', startTime: '08:00', tableIds: [t1, t2] }).expect(201);
    sessionId = created.body.data.id;
    const place = (matchId: string, tableId: string, orderInSession: number) =>
      kit.write('patch', `${API}/matches/${matchId}/schedule`, admin, { sessionId, tableId, orderInSession, expectedScheduleVersion: 0 }).expect(200);
    await place(sf.singles[0]!.id, t1!, 1);
    await place(sf.singles[1]!.id, t1!, 2);
    await place(sf.doubles[0]!.id, t2!, 1);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await queue.close();
    await sf?.cleanup();
    await kit.close();
  }, 60_000);

  it('returns print data for a session, narrowed by table, in table and slot order', async () => {
    const res = await kit.get(`${API}/events/${sf.fx.eventId}/match-sheets?sessionId=${sessionId}`, operator).expect(200);
    const { sheets, event, truncated } = res.body.data;
    expect(event).toMatchObject({ id: sf.fx.eventId, timezone: 'Asia/Ho_Chi_Minh' });
    expect(truncated).toBe(false);
    expect(sheets.map((s: { matchNo: number }) => s.matchNo)).toEqual([sf.singles[0]!.matchNo, sf.singles[1]!.matchNo, sf.doubles[0]!.matchNo]);
    expect(sheets[0]).toMatchObject({
      sessionCode: 'S01',
      sessionDate: SESSION_DATE,
      tableCode: 'T1',
      orderInSession: 1,
      subEventCode: 'MS',
      scheduledAt: '2099-05-01T01:00:00.000Z',
      side1: { name: expect.any(String), club: expect.any(String) },
    });
    expect(sheets[0].bestOf).toBeGreaterThanOrEqual(1);
    expect(sheets[0].pointsPerGame).toBeGreaterThanOrEqual(1);
    const pair = sheets[2];
    expect(pair.subEventCode).toBe('MD');
    expect(`${pair.side1.club}|${pair.side2.club}`).toContain('CLB Alpha');

    const onTable = await kit.get(`${API}/events/${sf.fx.eventId}/match-sheets?sessionId=${sessionId}&tableId=${sf.tableIds[1]}`, admin).expect(200);
    expect(onTable.body.data.sheets.map((s: { tableCode: string }) => s.tableCode)).toEqual(['T2']);
    await kit.get(`${API}/events/${randomUUID()}/match-sheets`, admin).expect(404);
    await kit.get(`${API}/events/${sf.fx.eventId}/match-sheets?sessionId=nope`, admin).expect(422);
    await kit.get(`${API}/events/${sf.fx.eventId}/match-sheets`).expect(401);
  });

  it('streams the schedule workbook with scheduled matches only', async () => {
    const { res, sheet } = await download(`${API}/exports/schedule?eventId=${sf.fx.eventId}`);
    expect(res.headers['content-disposition']).toContain(`lich-thi-dau-${slug}.xlsx`);
    expect(sheet.rowCount).toBe(4);
    expect(String(sheet.getRow(1).getCell(1).value)).toBe('Ngày');
    expect(String(sheet.getRow(2).getCell(2).value)).toBe('S01');
    expect(String(sheet.getRow(2).getCell(3).value)).toBe('08:00');
    expect(String(sheet.getRow(2).getCell(4).value)).toBe('T1');
    expect(Number(sheet.getRow(2).getCell(6).value)).toBe(sf.singles[0]!.matchNo);
    expect(String(sheet.getRow(2).getCell(14).value)).toBe('Chưa đấu');
    await kit.get(`${API}/exports/schedule?eventId=${randomUUID()}`, admin).expect(404);
    await kit.get(`${API}/exports/schedule?eventId=nope`, admin).expect(422);
    await kit.get(`${API}/exports/schedule?eventId=${sf.fx.eventId}`).expect(401);
  });

  it('streams confirmed results with per-game scores', async () => {
    const empty = await download(`${API}/exports/results?eventId=${sf.fx.eventId}`);
    expect(empty.sheet.rowCount).toBe(1);

    const match = await kit.prisma.match.findUniqueOrThrow({ where: { id: sf.singles[0]!.id } });
    const format = await kit.get(`${API}/matches/${match.id}`, operator).expect(200);
    const { bestOf, pointsPerGame } = format.body.data.format as { bestOf: number; pointsPerGame: number };
    const games = Array.from({ length: Math.ceil(bestOf / 2) }, () => ({ score1: pointsPerGame, score2: 3 }));
    await kit.write('post', `${API}/matches/${match.id}/confirm`, operator, { expectedVersion: match.version, resultType: 'NORMAL', games }).expect(200);

    const { sheet } = await download(`${API}/exports/results?eventId=${sf.fx.eventId}`, operator);
    expect(sheet.rowCount).toBe(2);
    const row = sheet.getRow(2);
    expect(Number(row.getCell(1).value)).toBe(match.matchNo);
    expect(String(row.getCell(9).value)).toBe(games.map((g) => `${g.score1}-${g.score2}`).join(', '));
    expect(String(row.getCell(10).value)).not.toBe('');
    expect(String(row.getCell(11).value)).toBe('Thường');
  });

  it('queues the schedule tags on a schedule change and every event tag on the refresh button', async () => {
    const m = sf.singles[2]!;
    const since = await pause().then(() => Date.now());
    const moved = await kit
      .write('patch', `${API}/matches/${m.id}/schedule`, admin, { sessionId, tableId: sf.tableIds[1], orderInSession: 2, expectedScheduleVersion: 0 })
      .expect(200);
    expect(moved.body.warnings).toBeUndefined();
    const scheduleTags = await queuedTags(since);
    for (const tag of [`event-${slug}`, `schedule-${slug}`, `match-${slug}-${m.matchNo}`]) expect(scheduleTags.has(tag), tag).toBe(true);

    await kit.write('post', `${API}/events/${sf.fx.eventId}/revalidate`, operator).expect(403);
    const mark = await pause().then(() => Date.now());
    const refreshed = await kit.write('post', `${API}/events/${sf.fx.eventId}/revalidate`, admin).expect(200);
    expect(refreshed.body.warnings).toBeUndefined();
    const tags = await queuedTags(mark);
    const expected = ['events', 'results-strip', `event-${slug}`, `schedule-${slug}`, `draw-${slug}-MS`, `groups-${slug}-MD`];
    for (const tag of expected) expect(tags.has(tag), tag).toBe(true);
    const allNos = (await kit.prisma.match.findMany({ where: { eventId: sf.fx.eventId }, select: { matchNo: true } })).map((x) => x.matchNo);
    for (const no of allNos) expect(tags.has(`match-${slug}-${no}`), `match ${no}`).toBe(true);
    await kit.write('post', `${API}/events/${randomUUID()}/revalidate`, admin).expect(404);

    const sessionMark = await pause().then(() => Date.now());
    await kit.write('patch', `${API}/events/${sf.fx.eventId}/sessions/${sessionId}`, admin, { name: 'Renamed' }).expect(200);
    const sessionTags = await queuedTags(sessionMark);
    expect(sessionTags.has(`schedule-${slug}`)).toBe(true);
    expect(sessionTags.has(`event-${slug}`)).toBe(true);
  });
  it('streams more than one page of rows without losing or repeating any, ties on time included', async () => {
    const template = await kit.prisma.match.findFirstOrThrow({ where: { eventId: sf.fx.eventId, subEventId: sf.fx.subEvents.MS } });
    const extra = 1100;
    await kit.prisma.match.createMany({
      data: Array.from({ length: extra }, (_, i) => ({
        eventId: template.eventId,
        subEventId: template.subEventId,
        drawId: template.drawId,
        roundId: template.roundId,
        orderInRound: 1000 + i,
        matchNo: 800_000 + i,
        sessionId,
        tableId: sf.tableIds[2],
        orderInSession: i + 1,
        scheduledAt: new Date('2099-05-01T05:00:00Z'),
        status: 'OFFICIAL' as const,
        resultType: 'NORMAL' as const,
        winnerSide: 1,
        games1: 3,
        games2: 0,
      })),
    });
    try {
      const matchNos = (sheet: ExcelJS.Worksheet) => sheet.getRows(2, sheet.rowCount - 1)!.map((r) => Number(r.getCell(sheet === schedule ? 6 : 1).value));
      const { sheet: schedule } = await download(`${API}/exports/schedule?eventId=${sf.fx.eventId}`);
      const scheduled = await kit.prisma.match.count({ where: { eventId: sf.fx.eventId, sessionId: { not: null }, isVoided: false } });
      expect(schedule.rowCount).toBe(scheduled + 1);
      const scheduleNos = matchNos(schedule);
      expect(new Set(scheduleNos).size).toBe(scheduleNos.length);

      const { sheet: results } = await download(`${API}/exports/results?eventId=${sf.fx.eventId}`);
      const official = await kit.prisma.match.count({ where: { eventId: sf.fx.eventId, status: 'OFFICIAL', isVoided: false } });
      expect(results.rowCount).toBe(official + 1);
      const resultNos = matchNos(results);
      expect(new Set(resultNos).size).toBe(resultNos.length);
    } finally {
      await kit.prisma.match.deleteMany({ where: { eventId: sf.fx.eventId, matchNo: { gte: 800_000 } } });
    }
  }, 60_000);
});
