import { randomUUID } from 'node:crypto';
import { todayInTimezone } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_INFO_BODY } from '../src/modules/events/event-dtos.js';
import { AuthTestKit } from './support/auth-test-kit.js';

const EVENTS = '/api/v1/admin/events';
// UTC+14 and UTC-11: their calendar dates always differ, so one UTC instant is a different "today" in each.
const AHEAD_TZ = 'Pacific/Kiritimati';
const BEHIND_TZ = 'Pacific/Pago_Pago';

describe('event guards (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let eventTypeId: string;
  const tag = `G${randomUUID().slice(0, 6)}`;
  const createdIds: string[] = [];

  const create = async (overrides: Record<string, unknown> = {}) => {
    const res = await kit
      .write('post', EVENTS, cookie, { name: `Giải ${tag} ${randomUUID().slice(0, 4)}`, eventTypeId, startDate: '2099-03-01', endDate: '2099-03-03', ...overrides })
      .expect(201);
    createdIds.push(res.body.data.id);
    return res.body.data as { id: string; slug: string };
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    eventTypeId = (await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await kit.prisma.auditLog.deleteMany({ where: { entity: 'Event', entityId: { in: createdIds } } });
    await kit.prisma.event.deleteMany({ where: { id: { in: createdIds } } });
    await kit.close();
  });

  it('accepts rich text at the field maximum (multibyte) and answers oversize bodies with the JSON error shape', async () => {
    const event = await create();
    const infoBody = 'Đ'.repeat(MAX_INFO_BODY);
    const ok = await kit.write('patch', `${EVENTS}/${event.id}`, cookie, { infoBody, infoBodyEn: infoBody }).expect(200);
    expect(ok.body.data.infoBody.length).toBe(MAX_INFO_BODY);

    const tooBig = await kit.write('patch', `${EVENTS}/${event.id}`, cookie, { infoBody: 'x'.repeat(2 * 1024 * 1024) }).expect(413);
    expect(tooBig.body.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  });

  it('locks the slug while published and frees it after unpublish', async () => {
    const event = await create();
    await kit.write('post', `${EVENTS}/${event.id}/publish`, cookie).expect(200);
    const locked = await kit.write('patch', `${EVENTS}/${event.id}`, cookie, { slug: `${event.slug}-moi` }).expect(422);
    expect(locked.body.error.fields.slug).toBe('Bỏ công bố trước khi đổi đường dẫn');
    await kit.write('patch', `${EVENTS}/${event.id}`, cookie, { slug: event.slug, city: 'Huế' }).expect(200);
    await kit.write('post', `${EVENTS}/${event.id}/unpublish`, cookie).expect(200);
    const renamed = await kit.write('patch', `${EVENTS}/${event.id}`, cookie, { slug: `${event.slug}-moi` }).expect(200);
    expect(renamed.body.data.slug).toBe(`${event.slug}-moi`);
  });

  it('filters lifecycle by each event timezone, not the default one', async () => {
    const tzTag = `TZ${randomUUID().slice(0, 6)}`;
    const day = todayInTimezone(AHEAD_TZ);
    const ahead = await create({ name: `Zone ahead ${tzTag}`, timezone: AHEAD_TZ, startDate: day, endDate: day });
    const behind = await create({ name: `Zone behind ${tzTag}`, timezone: BEHIND_TZ, startDate: day, endDate: day });
    const ids = async (lifecycle: string) =>
      ((await kit.get(`${EVENTS}?q=${tzTag}&pageSize=100&filter[lifecycle]=${lifecycle}`, cookie).expect(200)).body.data as { id: string }[]).map((row) => row.id);

    expect(await ids('ONGOING')).toEqual([ahead.id]);
    expect(await ids('UPCOMING')).toEqual([behind.id]);
  });

  it('exposes the default duration with the form defaults', async () => {
    const res = await kit.get(`${EVENTS}/defaults`, cookie).expect(200);
    expect(res.body.data).toMatchObject({ defaultDurationDays: expect.any(Number), timezone: expect.any(String) });
  });
});
