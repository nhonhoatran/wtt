import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';

const API = '/api/v1/admin';
const suffix = randomUUID().slice(0, 6).toUpperCase();
const code = (name: string) => `E2E${suffix}${name}`;

describe('admin catalogs (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  const created: Record<'tier' | 'eventType' | 'category' | 'discipline' | 'matchFormat' | 'groupScoringRule' | 'event', string[]> = {
    tier: [],
    eventType: [],
    category: [],
    discipline: [],
    matchFormat: [],
    groupScoringRule: [],
    event: [],
  };
  let originalDefaults: { matchFormat: string[]; groupScoringRule: string[] };

  const post = (path: string, body: object, cookie = admin) => kit.write('post', `${API}/${path}`, cookie, body);
  const patch = (path: string, body: object) => kit.write('patch', `${API}/${path}`, admin, body);
  const del = (path: string) => kit.write('delete', `${API}/${path}`, admin);

  async function createTier(name: string, extra: object = {}) {
    const res = await post('tiers', { code: code(name), name: `Tier ${name}`, colorHex: '#112233', ...extra }).expect(201);
    created.tier.push(res.body.data.id);
    return res.body.data;
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    const where = { isDefault: true };
    const select = { id: true };
    originalDefaults = {
      matchFormat: (await kit.prisma.matchFormat.findMany({ where, select })).map((row) => row.id),
      groupScoringRule: (await kit.prisma.groupScoringRule.findMany({ where, select })).map((row) => row.id),
    };
  });

  afterAll(async () => {
    const { prisma } = kit;
    await prisma.event.deleteMany({ where: { id: { in: created.event } } });
    await prisma.eventType.deleteMany({ where: { id: { in: created.eventType } } });
    await prisma.tier.deleteMany({ where: { id: { in: created.tier } } });
    await prisma.category.deleteMany({ where: { id: { in: created.category } } });
    await prisma.discipline.deleteMany({ where: { id: { in: created.discipline } } });
    await prisma.matchFormat.deleteMany({ where: { id: { in: created.matchFormat } } });
    await prisma.groupScoringRule.deleteMany({ where: { id: { in: created.groupScoringRule } } });
    await prisma.matchFormat.updateMany({ where: { id: { in: originalDefaults.matchFormat } }, data: { isDefault: true } });
    await prisma.groupScoringRule.updateMany({ where: { id: { in: originalDefaults.groupScoringRule } }, data: { isDefault: true } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: Object.values(created).flat() } } });
    await kit.close();
  });

  describe('tiers: list, filters, validation', () => {
    it('paginates, sorts, filters and reports a total that matches the filter', async () => {
      const a = await createTier('A', { order: 3 });
      await createTier('B', { order: 1 });
      await createTier('C', { order: 2 });
      await patch(`tiers/${a.id}`, { isActive: false }).expect(200);

      const page1 = await kit.get(`${API}/tiers?q=${code('')}&sort=order:asc&pageSize=2&page=1`, admin).expect(200);
      expect(page1.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(page1.body.data.map((row: { code: string }) => row.code)).toEqual([code('B'), code('C')]);

      const page2 = await kit.get(`${API}/tiers?q=${code('')}&sort=order:asc&pageSize=2&page=2`, admin).expect(200);
      expect(page2.body.data.map((row: { code: string }) => row.code)).toEqual([code('A')]);

      const hidden = await kit.get(`${API}/tiers?q=${code('')}&filter[isActive]=false`, admin).expect(200);
      expect(hidden.body.total).toBe(1);
      expect(hidden.body.data[0].code).toBe(code('A'));
    });

    it('rejects sort fields and filters outside the whitelist with 400', async () => {
      await kit.get(`${API}/tiers?sort=colorHex:asc`, admin).expect(400);
      await kit.get(`${API}/tiers?filter[colorHex]=x`, admin).expect(400);
      await kit.get(`${API}/tiers?filter[isActive]=maybe`, admin).expect(400);
    });

    it('normalises codes to upper case and reports duplicates and bad colours as field errors', async () => {
      const row = await createTier('D', { code: code('d').toLowerCase() });
      expect(row.code).toBe(code('d').toUpperCase());

      const duplicate = await post('tiers', { code: row.code, name: 'again', colorHex: '#000000' }).expect(422);
      expect(duplicate.body.error.fields).toHaveProperty('code');
      const badColor = await post('tiers', { code: code('E'), name: 'x', colorHex: 'red' }).expect(422);
      expect(badColor.body.error.fields).toHaveProperty('colorHex');
      const badCode = await post('tiers', { code: 'has space', name: 'x', colorHex: '#000000' }).expect(422);
      expect(badCode.body.error.fields).toHaveProperty('code');
      const missingMedia = await post('tiers', { code: code('F'), name: 'x', colorHex: '#000000', logoMediaId: randomUUID() }).expect(422);
      expect(missingMedia.body.error.fields).toHaveProperty('logoMediaId');
    });

    it('writes an audit row in the same transaction', async () => {
      const row = await createTier('G');
      await patch(`tiers/${row.id}`, { name: 'Renamed' }).expect(200);
      const actions = await kit.prisma.auditLog.findMany({ where: { entityId: row.id }, orderBy: { createdAt: 'asc' } });
      expect(actions.map((entry) => entry.action)).toEqual(['tier.create', 'tier.update']);
      expect(actions[1]).toMatchObject({ before: { name: 'Tier G' }, after: { name: 'Renamed' } });
    });

    it('lets RESULTS_OPERATOR read but not write', async () => {
      await kit.get(`${API}/tiers`, operator).expect(200);
      await post('tiers', { code: code('H'), name: 'x', colorHex: '#000000' }, operator).expect(403);
      await kit.write('delete', `${API}/tiers/${randomUUID()}`, operator).expect(403);
    });

    it('returns 404 for an unknown id', async () => {
      await kit.get(`${API}/tiers/${randomUUID()}`, admin).expect(404);
    });
  });

  describe('delete guard', () => {
    it('refuses to delete a tier, then an event type, that is still in use and reports the counts', async () => {
      const tier = await createTier('I');
      const typeRes = await post('event-types', { tierId: tier.id, code: code('T1'), name: 'Type' }).expect(201);
      const eventType = typeRes.body.data;
      created.eventType.push(eventType.id);
      expect(eventType.tier).toMatchObject({ id: tier.id });

      const event = await kit.prisma.event.create({
        data: { slug: `e2e-${suffix.toLowerCase()}-i`, name: 'E2E event', eventTypeId: eventType.id, startDate: new Date('2030-01-01'), endDate: new Date('2030-01-02'), timezone: 'Asia/Ho_Chi_Minh' },
      });
      created.event.push(event.id);

      const tierBlocked = await del(`tiers/${tier.id}`).expect(409);
      expect(tierBlocked.body.error).toMatchObject({ code: 'IN_USE', dependants: { eventTypes: 1 } });
      const typeBlocked = await del(`event-types/${eventType.id}`).expect(409);
      expect(typeBlocked.body.error).toMatchObject({ code: 'IN_USE', dependants: { events: 1 } });

      await patch(`event-types/${eventType.id}`, { isActive: false }).expect(200);
      const [typeAudit] = await kit.prisma.auditLog.findMany({ where: { action: 'eventType.update', entityId: eventType.id } });
      expect(typeAudit?.before).toMatchObject({ tier: { id: tier.id, code: tier.code } });
      expect(typeAudit?.after).toMatchObject({ tier: { id: tier.id } });
      const hiddenTypes = await kit.get(`${API}/event-types?filter[tierId]=${tier.id}&filter[isActive]=false`, admin).expect(200);
      expect(hiddenTypes.body.total).toBe(1);

      await kit.prisma.event.delete({ where: { id: event.id } });
      await del(`event-types/${eventType.id}`).expect(200);
      await del(`tiers/${tier.id}`).expect(200);
      expect(await kit.prisma.tier.count({ where: { id: tier.id } })).toBe(0);
    });

    it('refuses a discipline or category used by a sub-event', async () => {
      const disciplineRes = await post('disciplines', { code: code('DS'), name: 'Disc', competitorKind: 'SINGLES', genderRule: 'MEN' }).expect(201);
      const categoryRes = await post('categories', { kind: 'AGE', code: code('CT'), name: 'Cat', minAge: 10, maxAge: 12 }).expect(201);
      created.discipline.push(disciplineRes.body.data.id);
      created.category.push(categoryRes.body.data.id);

      const tier = await createTier('J');
      const typeRes = await post('event-types', { tierId: tier.id, code: code('T2'), name: 'Type' }).expect(201);
      created.eventType.push(typeRes.body.data.id);
      const matchFormat = await kit.prisma.matchFormat.findFirstOrThrow();
      const event = await kit.prisma.event.create({
        data: { slug: `e2e-${suffix.toLowerCase()}-j`, name: 'E2E', eventTypeId: typeRes.body.data.id, startDate: new Date('2030-02-01'), endDate: new Date('2030-02-02'), timezone: 'Asia/Ho_Chi_Minh' },
      });
      created.event.push(event.id);
      await kit.prisma.subEvent.create({
        data: { eventId: event.id, disciplineId: disciplineRes.body.data.id, categoryId: categoryRes.body.data.id, code: 'MS', format: 'KNOCKOUT', matchFormatId: matchFormat.id },
      });

      const discipline = await del(`disciplines/${disciplineRes.body.data.id}`).expect(409);
      expect(discipline.body.error).toMatchObject({ code: 'IN_USE', dependants: { subEvents: 1 } });
      await del(`categories/${categoryRes.body.data.id}`).expect(409);
      const format = await del(`match-formats/${matchFormat.id}`).expect(409);
      expect(format.body.error.code).toMatch(/IN_USE|IS_DEFAULT/);
    });
  });

  describe('categories and disciplines', () => {
    it('validates the age range and filters by kind', async () => {
      const bad = await post('categories', { kind: 'AGE', code: code('K1'), name: 'x', minAge: 15, maxAge: 10 }).expect(422);
      expect(bad.body.error.fields).toHaveProperty('maxAge');
      const ok = await post('categories', { kind: 'SKILL', code: code('K2'), name: 'Skill', nameEn: 'Skill EN' }).expect(201);
      created.category.push(ok.body.data.id);
      const patchBad = await patch(`categories/${ok.body.data.id}`, { minAge: 20, maxAge: 5 }).expect(422);
      expect(patchBad.body.error.fields).toHaveProperty('maxAge');

      const list = await kit.get(`${API}/categories?q=${code('K')}&filter[kind]=SKILL`, admin).expect(200);
      expect(list.body).toMatchObject({ total: 1 });
      await kit.get(`${API}/categories?filter[kind]=NOPE`, admin).expect(400);
    });

    it('requires a valid competitor kind and gender rule on disciplines', async () => {
      const bad = await post('disciplines', { code: code('D1'), name: 'x', competitorKind: 'TRIPLES', genderRule: 'MEN' }).expect(422);
      expect(bad.body.error.fields).toHaveProperty('competitorKind');
    });
  });

  describe('match formats: exactly one default', () => {
    const format = (name: string, extra: object = {}) =>
      post('match-formats', { name: `E2E ${suffix} ${name}`, bestOf: 5, pointsPerGame: 11, winBy: 2, estimatedMinutes: 25, ...extra });

    it('enforces guard rails on the numbers', async () => {
      for (const bad of [{ bestOf: 4 }, { bestOf: 11 }, { pointsPerGame: 4 }, { winBy: 6 }, { estimatedMinutes: 300 }]) {
        await format('bad', bad).expect(422);
      }
    });

    it('moves the default, refuses to unset or delete the only default', async () => {
      const first = (await format('one', { isDefault: true }).expect(201)).body.data;
      const second = (await format('two').expect(201)).body.data;
      created.matchFormat.push(first.id, second.id);
      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(false);

      await patch(`match-formats/${second.id}`, { isDefault: true }).expect(200);
      const defaults = await kit.prisma.matchFormat.findMany({ where: { isDefault: true } });
      expect(defaults.map((row) => row.id)).toEqual([second.id]);

      const unset = await patch(`match-formats/${second.id}`, { isDefault: false }).expect(422);
      expect(unset.body.error.fields).toHaveProperty('isDefault');
      const hide = await patch(`match-formats/${second.id}`, { isActive: false }).expect(422);
      expect(hide.body.error.fields).toHaveProperty('isActive');
      const remove = await del(`match-formats/${second.id}`).expect(409);
      expect(remove.body.error.code).toBe('IS_DEFAULT');

      await del(`match-formats/${first.id}`).expect(200);
    });
  });

  describe('group scoring rules', () => {
    const rule = (name: string, extra: object = {}) =>
      post('group-scoring-rules', {
        name: `E2E ${suffix} ${name}`,
        pointsWin: 2,
        pointsLoss: 1,
        pointsWalkoverLoss: 0,
        pointsUnfinishedLoss: 0,
        unfinishedMatchScoring: 'COUNT_PLAYED_ONLY',
        tiebreakers: ['HEAD_TO_HEAD_POINTS', 'GAME_RATIO'],
        ...extra,
      });

    it('requires awarded game points only for AWARD_REMAINING_TO_WINNER', async () => {
      const missing = await rule('award', { unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER' }).expect(422);
      expect(missing.body.error.fields).toHaveProperty('awardedGamePoints');
      const ok = (await rule('award-ok', { unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER', awardedGamePoints: 2 }).expect(201)).body.data;
      created.groupScoringRule.push(ok.id);
      const counted = (await patch(`group-scoring-rules/${ok.id}`, { unfinishedMatchScoring: 'COUNT_PLAYED_ONLY' }).expect(200)).body.data;
      expect(counted.awardedGamePoints).toBeNull();
    });

    it('flags a missing withdrawal policy and validates tiebreakers', async () => {
      const row = (await rule('policy').expect(201)).body.data;
      created.groupScoringRule.push(row.id);
      expect(row).toMatchObject({ withdrawalPolicy: null, withdrawalPolicyMissing: true });
      const set = (await patch(`group-scoring-rules/${row.id}`, { withdrawalPolicy: 'KEEP_PLAYED_RESULTS' }).expect(200)).body.data;
      expect(set).toMatchObject({ withdrawalPolicyMissing: false });

      const duplicated = await rule('dup', { tiebreakers: ['GAME_RATIO', 'GAME_RATIO'] }).expect(422);
      expect(duplicated.body.error.fields).toHaveProperty('tiebreakers');
      await rule('empty', { tiebreakers: [] }).expect(422);
      await rule('unknown', { tiebreakers: ['COIN_FLIP'] }).expect(422);
    });

    it('keeps a single default rule', async () => {
      const first = (await rule('d1', { isDefault: true }).expect(201)).body.data;
      const second = (await rule('d2', { isDefault: true }).expect(201)).body.data;
      created.groupScoringRule.push(first.id, second.id);
      const defaults = await kit.prisma.groupScoringRule.findMany({ where: { isDefault: true } });
      expect(defaults.map((row) => row.id)).toEqual([second.id]);
      await del(`group-scoring-rules/${second.id}`).expect(409);
    });
  });
});
