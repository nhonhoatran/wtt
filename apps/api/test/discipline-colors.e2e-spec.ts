import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';

const API = '/api/v1/admin/disciplines';

describe('discipline color migration and catalog persistence (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  const ids: string[] = [];
  const tag = randomUUID().slice(0, 8).toUpperCase();
  let serial = 0;
  const create = async (extra: object = {}) => {
    const response = await kit.write('post', API, admin, { code: `COL-${tag}-${serial++}`, name: `Color ${tag}`, competitorKind: 'SINGLES', genderRule: 'MEN', ...extra });
    if (response.body.data?.id) ids.push(response.body.data.id);
    return response;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
  });
  afterAll(async () => {
    if (!kit) return;
    try {
      await kit.prisma.discipline.deleteMany({ where: { id: { in: ids } } });
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    } finally { await kit.close(); }
  });

  it('adds an optional text column with no forced color for existing rows', async () => {
    const columns = await kit.prisma.$queryRaw<{ is_nullable: string; data_type: string; column_default: string | null }[]>`
      SELECT is_nullable, data_type, column_default FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Discipline' AND column_name = 'colorHex'
    `;
    expect(columns).toEqual([{ is_nullable: 'YES', data_type: 'text', column_default: null }]);
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.body.data.colorHex).toBeNull();
  });

  it('persists normalized colors, preserves an omitted patch and clears picker values', async () => {
    const response = await create({ colorHex: '#12abef' });
    expect(response.status).toBe(201);
    const id = response.body.data.id;
    expect(response.body.data.colorHex).toBe('#12ABEF');
    expect((await kit.get(`${API}/${id}`, admin).expect(200)).body.data.colorHex).toBe('#12ABEF');
    expect((await kit.write('patch', `${API}/${id}`, admin, { name: `Changed ${tag}` }).expect(200)).body.data.colorHex).toBe('#12ABEF');
    expect((await kit.write('patch', `${API}/${id}`, admin, { colorHex: null }).expect(200)).body.data.colorHex).toBeNull();
    await kit.write('patch', `${API}/${id}`, admin, { colorHex: '#123456' }).expect(200);
    expect((await kit.write('patch', `${API}/${id}`, admin, { colorHex: '' }).expect(200)).body.data.colorHex).toBeNull();
  });

  it('rejects invalid colors before persistence and retains the previous valid color', async () => {
    for (const colorHex of ['red', '#fff', '#12345678', 'url(https://example.invalid/pixel)']) {
      const response = await create({ colorHex });
      expect(response.status).toBe(422);
      expect(response.body.error.fields).toHaveProperty('colorHex');
    }
    const response = await create({ colorHex: '#112233' });
    expect(response.status).toBe(201);
    await kit.write('patch', `${API}/${response.body.data.id}`, admin, { colorHex: 'red' }).expect(422);
    expect((await kit.get(`${API}/${response.body.data.id}`, admin).expect(200)).body.data.colorHex).toBe('#112233');
  });

  it('keeps color configuration under the existing tournament write permission', async () => {
    const response = await create({ colorHex: '#112233' });
    expect(response.status).toBe(201);
    await kit.write('patch', `${API}/${response.body.data.id}`, operator, { colorHex: '#445566' }).expect(403);
    expect((await kit.get(`${API}/${response.body.data.id}`, operator).expect(200)).body.data.colorHex).toBe('#112233');
  });

  it('returns discipline identity and its current nullable color on schedule match reads', async () => {
    const identity = async (extra: object = {}) => {
      const response = await create(extra);
      expect(response.status).toBe(201);
      const { id, code, name } = response.body.data as { id: string; code: string; name: string };
      return { id, code, name };
    };
    const colored = await identity({ colorHex: '#123456' });
    const neutral = await identity();
    let fx: Fixtures | undefined;
    try {
      fx = await createEventFixtures(kit, admin, [colored.code, neutral.code]);
      const players = new DrawFixtureKit(kit, admin, fx);
      for (const discipline of [colored, neutral]) {
        const subEventId = fx.subEvents[discipline.code]!;
        await players.addEntries(subEventId, 0, 2);
        const draw = await kit.write('post', `/api/v1/admin/sub-events/${subEventId}/draws`, admin, { kind: 'MAIN' }).expect(201);
        await kit.write('post', `/api/v1/admin/draws/${draw.body.data.id}/publish`, admin, { expectedVersion: draw.body.data.version }).expect(200);
      }
      const url = `/api/v1/admin/events/${fx.eventId}/matches?pageSize=50`;
      const listed = (await kit.get(url, operator).expect(200)).body.data as { id: string; discipline: { id: string; code: string; name: string; colorHex: string | null } }[];
      expect(listed).toHaveLength(2);
      for (const discipline of [colored, neutral]) {
        const match = listed.find((item) => item.discipline.id === discipline.id)!;
        const expected = { ...discipline, colorHex: discipline.id === colored.id ? '#123456' : null };
        expect(match.discipline).toEqual(expected);
        const detail = (await kit.get(`/api/v1/admin/matches/${match.id}`, operator).expect(200)).body.data;
        expect(detail.discipline).toEqual(expected);
      }
      await kit.write('patch', `${API}/${colored.id}`, admin, { colorHex: '#ABCDEF' }).expect(200);
      const refreshed = (await kit.get(url, operator).expect(200)).body.data as typeof listed;
      expect(refreshed.find((item) => item.discipline.id === colored.id)?.discipline.colorHex).toBe('#ABCDEF');
    } finally {
      if (fx) {
        await cleanupDraws(kit, Object.values(fx.subEvents), fx.eventId);
        await cleanupFixtures(kit, fx);
      }
    }
  });
});
