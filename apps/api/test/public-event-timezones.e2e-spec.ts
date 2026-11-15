import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todayInTimezone, tournamentSettings } from '@kamito/shared';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { publicGet } from './support/public-api-kit.js';

describe('public lifecycle filters across event timezones (real Postgres)', () => {
  let kit: AuthTestKit;
  let secret: string;
  const tag = `zones-${randomUUID().slice(0, 8)}`;
  const ids: string[] = [];
  const instant = new Date('2026-11-15T00:30:00Z');

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
    for (const [index, timezone] of ['Pacific/Kiritimati', 'America/Los_Angeles', '+05:30', '-08:00', '+0530', '-08', 'UTC'].entries()) {
      // Each event is the same one calendar day. At one instant the west is still upcoming, the east ongoing.
      const row = await kit.prisma.event.create({ data: { slug: `${tag}-${index}`, name: tag, eventTypeId: eventType.id,
        startDate: new Date('2026-11-15'), endDate: new Date('2026-11-15'), timezone, publishStatus: 'PUBLISHED' } });
      ids.push(row.id);
    }
  });

  afterAll(async () => {
    if (!kit) return;
    await kit.prisma.event.deleteMany({ where: { id: { in: ids } } });
    await kit.close();
  });

  it('filters and counts in each event timezone before paginating, using the same instant as badges', async () => {
    const settings = kit.app.get(AppSettingsService);
    const get = settings.get.bind(settings);
    const limit = vi.spyOn(settings, 'get').mockImplementation((def) => def.key === tournamentSettings.publicListPageSize.key ? Promise.resolve(2) : get(def));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);
    try {
      for (const [status, expected] of [['upcoming', 3], ['ongoing', 4], ['completed', 0]] as const) {
        const seen: string[] = [];
        for (let page = 1; page <= 3; page++) {
          const { data } = (await publicGet(kit, secret, `events?q=${tag}&status=${status}&page=${page}`).expect(200)).body;
          expect(data.total).toBe(expected);
          expect(data.items.length).toBe(Math.min(2, Math.max(0, expected - (page - 1) * 2)));
          for (const item of data.items) {
            expect(item.lifecycle).toBe(status.toUpperCase());
            const day = todayInTimezone(item.timezone, instant);
            expect(status === 'upcoming' ? day < item.startDate : day >= item.startDate && day <= item.endDate).toBe(true);
            seen.push(item.slug);
          }
        }
        expect(new Set(seen).size).toBe(expected);
      }
      vi.setSystemTime(new Date('2026-11-17T00:30:00Z'));
      const { data } = (await publicGet(kit, secret, `events?q=${tag}&status=completed&page=2`).expect(200)).body;
      expect(data.total).toBe(7);
      expect(data.items).toHaveLength(2);
      expect(data.items.every((item: { lifecycle: string }) => item.lifecycle === 'COMPLETED')).toBe(true);
    } finally { vi.useRealTimers(); limit.mockRestore(); }
  });
});
