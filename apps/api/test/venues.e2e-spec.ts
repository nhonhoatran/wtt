import { randomUUID } from 'node:crypto';
import { tournamentSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';

const API = '/api/v1/admin/venues';
const suffix = randomUUID().slice(0, 6).toUpperCase();

describe('admin venues and tables (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  const venueIds: string[] = [];
  const eventIds: string[] = [];
  const typeIds: string[] = [];
  const tierIds: string[] = [];

  const write = (method: 'post' | 'patch' | 'delete', path: string, body: object = {}, cookie = admin) =>
    kit.write(method, `${API}${path}`, cookie, body);

  async function createVenue(name: string, extra: object = {}) {
    const res = await write('post', '', { name: `E2E ${suffix} ${name}`, ...extra }).expect(201);
    venueIds.push(res.body.data.id);
    return res.body.data;
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
  });

  afterAll(async () => {
    const { prisma } = kit;
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.eventType.deleteMany({ where: { id: { in: typeIds } } });
    await prisma.tier.deleteMany({ where: { id: { in: tierIds } } });
    const tables = await prisma.venueTable.findMany({ where: { venueId: { in: venueIds } }, select: { id: true } });
    await prisma.venue.deleteMany({ where: { id: { in: venueIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...venueIds, ...tables.map((table) => table.id)] } } });
    await kit.close();
  });

  it('lists with search, sort, pagination and a matching total', async () => {
    for (const name of ['Alpha', 'Bravo', 'Charlie']) await createVenue(name, { city: 'Hà Nội' });
    const page = await kit.get(`${API}?q=${suffix}&sort=name:desc&pageSize=2&page=1`, admin).expect(200);
    expect(page.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page.body.data.map((row: { name: string }) => row.name)).toEqual([`E2E ${suffix} Charlie`, `E2E ${suffix} Bravo`]);
    expect(page.body.data[0]).toMatchObject({ tableCount: 0 });
    await kit.get(`${API}?sort=mapUrl:asc`, admin).expect(400);
  });

  it('accepts https map links and rejects http, javascript and malformed ones with 422', async () => {
    const ok = await createVenue('Map', { mapUrl: 'https://maps.example.com/?q=1' });
    expect(ok.mapUrl).toBe('https://maps.example.com/?q=1');
    for (const mapUrl of ['http://maps.example.com', 'javascript:alert(1)', '//evil.example.com', 'not a url']) {
      const res = await write('post', '', { name: `E2E ${suffix} bad`, mapUrl }).expect(422);
      expect(res.body.error.fields).toHaveProperty('mapUrl');
    }
    const patched = await write('patch', `/${ok.id}`, { mapUrl: 'http://insecure.example.com' }).expect(422);
    expect(patched.body.error.fields).toHaveProperty('mapUrl');
    const cleared = await write('patch', `/${ok.id}`, { mapUrl: '' }).expect(200);
    expect(cleared.body.data.mapUrl).toBeNull();
  });

  it('creates tables in bulk with a prefix, continues numbering and skips existing codes', async () => {
    const venue = await createVenue('Bulk');
    const first = await write('post', `/${venue.id}/tables/bulk`, { count: 3, prefix: 'e2e' }).expect(201);
    expect(first.body.data.map((row: { code: string }) => row.code)).toEqual(['E2E01', 'E2E02', 'E2E03']);

    const next = await write('post', `/${venue.id}/tables/bulk`, { count: 2, prefix: 'E2E' }).expect(201);
    expect(next.body.data.map((row: { code: string }) => row.code)).toEqual(['E2E04', 'E2E05']);

    const overlap = await write('post', `/${venue.id}/tables/bulk`, { count: 3, prefix: 'E2E', startAt: 4 }).expect(201);
    expect(overlap.body.data.map((row: { code: string }) => row.code)).toEqual(['E2E06']);

    const defaultPrefix = (await kit.prisma.appSetting.findUnique({ where: { key: tournamentSettings.tablePrefix.key } }))?.value ?? tournamentSettings.tablePrefix.defaultValue;
    const withDefault = await write('post', `/${venue.id}/tables/bulk`, { count: 1 }).expect(201);
    expect(withDefault.body.data.map((row: { code: string }) => row.code)).toEqual([`${String(defaultPrefix).toUpperCase()}01`]);

    const detail = await kit.get(`${API}/${venue.id}`, admin).expect(200);
    expect(detail.body.data.tableCount).toBe(7);
    const orders = detail.body.data.tables.map((row: { order: number }) => row.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    await write('post', `/${venue.id}/tables/bulk`, { count: 0 }).expect(422);
    await write('post', `/${venue.id}/tables/bulk`, { count: 101 }).expect(422);
    await write('post', `/${randomUUID()}/tables/bulk`, { count: 1 }).expect(404);
  });

  it('manages single tables: duplicate code, update, list and delete', async () => {
    const venue = await createVenue('Tables');
    const table = (await write('post', `/${venue.id}/tables`, { code: 'a1', displayName: 'Bàn 1' }).expect(201)).body.data;
    expect(table).toMatchObject({ code: 'A1', displayName: 'Bàn 1', venueId: venue.id });

    const duplicate = await write('post', `/${venue.id}/tables`, { code: 'A1' }).expect(422);
    expect(duplicate.body.error.fields).toHaveProperty('code');
    await write('post', `/${venue.id}/tables`, { code: 'A2' }).expect(201);

    await write('patch', `/${venue.id}/tables/${table.id}`, { isActive: false }).expect(200);
    const list = await kit.get(`${API}/${venue.id}/tables?filter[isActive]=false`, admin).expect(200);
    expect(list.body).toMatchObject({ total: 1 });
    await write('patch', `/${randomUUID()}/tables/${table.id}`, { isActive: true }).expect(404);

    await write('delete', `/${venue.id}/tables/${table.id}`).expect(200);
    expect(await kit.prisma.venueTable.count({ where: { venueId: venue.id } })).toBe(1);
    await write('delete', `/${venue.id}/tables/${table.id}`).expect(404);
  });

  it('refuses to delete a venue used by an event, and deletes an unused one with its tables', async () => {
    const used = await createVenue('Used');
    const tier = await kit.prisma.tier.create({ data: { code: `E2E${suffix}V`, name: 'tier', colorHex: '#000000' } });
    tierIds.push(tier.id);
    const type = await kit.prisma.eventType.create({ data: { tierId: tier.id, code: `E2E${suffix}V`, name: 'type' } });
    typeIds.push(type.id);
    const event = await kit.prisma.event.create({
      data: { slug: `e2e-${suffix.toLowerCase()}-venue`, name: 'E2E', eventTypeId: type.id, venueId: used.id, startDate: new Date('2030-03-01'), endDate: new Date('2030-03-02'), timezone: 'Asia/Ho_Chi_Minh' },
    });
    eventIds.push(event.id);

    const blocked = await write('delete', `/${used.id}`).expect(409);
    expect(blocked.body.error).toMatchObject({ code: 'IN_USE', dependants: { events: 1 } });
    await write('patch', `/${used.id}`, { isActive: false }).expect(200);

    const free = await createVenue('Free');
    await write('post', `/${free.id}/tables`, { code: 'X1' }).expect(201);
    await write('delete', `/${free.id}`).expect(200);
    expect(await kit.prisma.venueTable.count({ where: { venueId: free.id } })).toBe(0);
  });

  it('lets RESULTS_OPERATOR read venues and tables but not change them', async () => {
    const venue = await createVenue('ReadOnly');
    await kit.get(API, operator).expect(200);
    await kit.get(`${API}/${venue.id}`, operator).expect(200);
    await kit.get(`${API}/${venue.id}/tables`, operator).expect(200);
    await write('post', '', { name: 'nope' }, operator).expect(403);
    await write('post', `/${venue.id}/tables`, { code: 'N1' }, operator).expect(403);
    await write('post', `/${venue.id}/tables/bulk`, { count: 2 }, operator).expect(403);
    await write('delete', `/${venue.id}`, {}, operator).expect(403);
  });

  it('audits venue and table changes', async () => {
    const venue = await createVenue('Audit');
    await write('post', `/${venue.id}/tables/bulk`, { count: 2, prefix: 'AU' }).expect(201);
    const actions = await kit.prisma.auditLog.findMany({ where: { entityId: venue.id }, orderBy: { createdAt: 'asc' } });
    expect(actions.map((row) => row.action)).toEqual(['venue.create', 'venueTable.bulkCreate']);
    expect(actions[1]?.after).toMatchObject({ created: ['AU01', 'AU02'] });
  });
});
