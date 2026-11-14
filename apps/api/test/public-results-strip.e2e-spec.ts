import { tournamentSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RevalidationEnqueueService } from '../src/modules/revalidation/revalidation-enqueue.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { cleanupPublicWorld, MATCH_CARD_KEYS, publicGet, type PublicWorld, setupPublicWorld, sortedPaths } from './support/public-api-kit.js';

const STRIP_EVENT_KEYS = ['event', 'event.slug', 'event.name', 'event.nameEn'];

const utcDay = (offsetDays: number) => {
  const day = new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00Z`);
};

describe('public results strip and settings revalidation (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let world: PublicWorld;
  let secret: string;

  const strip = () => publicGet(kit, secret, 'results/strip').expect(200).then((r) => r.body.data);
  const put = (key: string, value: unknown) => kit.write('put', `${API}/settings/${key}`, cookie, { value }).expect(200);
  const reset = (key: string) => kit.write('delete', `${API}/settings/${key}`, cookie).expect(200);
  const setEvent = (data: { startDate?: Date; endDate?: Date }) => kit.prisma.event.update({ where: { id: world.fx.eventId }, data });
  const ourItems = async () => ((await strip()).items as { event: { slug: string } }[]).filter((i) => i.event.slug === world.slug);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await reset('header.resultsStrip.enabled');
    await reset('header.resultsStrip.limit');
    await reset('public.listPageSize');
    await cleanupPublicWorld(kit, world);
    await kit.close();
  }, 60_000);

  it('answers null while the strip is switched off', async () => {
    await put('header.resultsStrip.enabled', false);
    expect(await strip()).toBeNull();
  });

  it('lists live and confirmed matches of events in progress today, and nothing from other events', async () => {
    await put('header.resultsStrip.enabled', true);
    await put('header.resultsStrip.limit', 30);
    await setEvent({ startDate: utcDay(-1), endDate: utcDay(1) });
    const items = await ourItems();
    expect(items.length).toBeGreaterThan(0);
    expect(sortedPaths(items)).toEqual([...MATCH_CARD_KEYS, ...STRIP_EVENT_KEYS].map((k) => `[].${k}`).sort());
  });

  it('drops the event once it is not in progress', async () => {
    await setEvent({ startDate: new Date('2099-05-01'), endDate: new Date('2099-05-02') });
    expect(await ourItems()).toEqual([]);
  });

  it('caps the strip at header.resultsStrip.limit', async () => {
    await put('header.resultsStrip.limit', 1);
    await setEvent({ startDate: utcDay(-1), endDate: utcDay(1) });
    expect((await strip()).items.length).toBeLessThanOrEqual(1);
  });

  it('enqueues the settings cache tag on PUT and on DELETE, and the page size follows the setting', async () => {
    const enqueue = vi.spyOn(kit.app.get(RevalidationEnqueueService), 'enqueue');
    await put('public.listPageSize', 6);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]()).toContain('settings');
    const listed = (await publicGet(kit, secret, `events?q=${world.tag}`).expect(200)).body.data;
    expect(listed.pageSize).toBe(6);

    await reset('public.listPageSize');
    expect(enqueue).toHaveBeenCalledTimes(2);
    const restored = (await publicGet(kit, secret, `events?q=${world.tag}`).expect(200)).body.data;
    expect(restored.pageSize).toBe(tournamentSettings.publicListPageSize.defaultValue);
    enqueue.mockRestore();
  });
});
