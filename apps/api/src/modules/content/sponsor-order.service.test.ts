import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@kamito/db';
import type { AuditService } from '../../common/audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { SponsorOrderService } from './sponsor-order.service.js';

function kit(rows = [{ id: 'a', order: 0 }, { id: 'b', order: 0 }, { id: 'c', order: 9 }]) {
  const events: string[] = [];
  const tx = {
    $executeRaw: vi.fn().mockImplementation(async () => { events.push('lock'); }),
    sponsor: {
      findMany: vi.fn().mockImplementation(async () => { events.push('load'); return rows; }),
      update: vi.fn().mockImplementation(async () => { events.push('update'); }),
    },
  };
  const prisma = { $transaction: vi.fn(async (run: (value: Prisma.TransactionClient) => Promise<unknown>) => {
    events.push('begin');
    try { const result = await run(tx as unknown as Prisma.TransactionClient); events.push('commit'); return result; }
    catch (error) { events.push('rollback'); throw error; }
  }) };
  const audit = { record: vi.fn().mockImplementation(async () => { events.push('audit'); }) };
  const revalidation = { enqueue: vi.fn().mockImplementation(async () => { events.push('refresh'); return ['PUBLIC_REFRESH_DELAYED']; }) };
  const service = new SponsorOrderService(prisma as unknown as PrismaService, audit as unknown as AuditService, revalidation as unknown as RevalidationEnqueueService);
  return { service, tx, audit, revalidation, events };
}

describe('SponsorOrderService', () => {
  it('locks an event scope, reads deterministic order, audits metadata, and returns cache warnings after commit', async () => {
    const k = kit();
    await expect(k.service.reorder({ eventId: 'event-id', orderedIds: ['c', 'b'] })).resolves.toEqual({
      data: { changedIds: ['c', 'b'] }, warnings: ['PUBLIC_REFRESH_DELAYED'],
    });
    expect(k.tx.$executeRaw.mock.calls[0]?.[1]).toBe('cms-sponsor-order:event-id');
    expect(k.tx.sponsor.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-id' }, select: { id: true, order: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    expect(k.tx.sponsor.update).toHaveBeenNthCalledWith(1, { where: { id: 'c' }, data: { order: 1 } });
    expect(k.tx.sponsor.update).toHaveBeenNthCalledWith(2, { where: { id: 'b' }, data: { order: 2 } });
    expect(k.audit.record).toHaveBeenCalledWith({
      action: 'sponsor.reorder', entity: 'Sponsor', entityId: 'event-id',
      before: { eventId: 'event-id', orders: [{ id: 'c', order: 9 }, { id: 'b', order: 0 }] },
      after: { eventId: 'event-id', orders: [{ id: 'c', order: 1 }, { id: 'b', order: 2 }] },
    }, k.tx);
    expect(k.events).toEqual(['begin', 'lock', 'load', 'update', 'update', 'audit', 'commit', 'refresh']);
  });

  it('uses a separate advisory scope for site-wide sponsors', async () => {
    const k = kit();
    await k.service.reorder({ eventId: null, orderedIds: ['c', 'b'] });
    expect(k.tx.$executeRaw.mock.calls[0]?.[1]).toBe('cms-sponsor-order:site-wide');
    expect(k.tx.sponsor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: null } }));
  });

  it.each([['b', 'b'], ['other-event']])('rejects invalid scope membership or duplicated selection %j before any update', async (...orderedIds: string[]) => {
    const k = kit();
    await expect(k.service.reorder({ eventId: 'event-id', orderedIds })).rejects.toMatchObject({
      response: { code: 'INVALID_SPONSOR_ORDER', fields: { orderedIds: expect.any(String) } },
    });
    expect(k.tx.sponsor.update).not.toHaveBeenCalled();
    expect(k.audit.record).not.toHaveBeenCalled();
    expect(k.revalidation.enqueue).not.toHaveBeenCalled();
    expect(k.events).toEqual(['begin', 'lock', 'load', 'rollback']);
  });

  it('rolls back the reorder when metadata audit fails and does not refresh public pages', async () => {
    const k = kit();
    k.audit.record.mockRejectedValue(new Error('audit failed'));
    await expect(k.service.reorder({ eventId: 'event-id', orderedIds: ['c', 'b'] })).rejects.toThrow('audit failed');
    expect(k.events.at(-1)).toBe('rollback');
    expect(k.revalidation.enqueue).not.toHaveBeenCalled();
  });

  it('skips writes, audit and cache refresh when ordering is unchanged', async () => {
    const k = kit([{ id: 'a', order: 0 }, { id: 'b', order: 1 }]);
    await expect(k.service.reorder({ eventId: null, orderedIds: ['a', 'b'] })).resolves.toEqual({ data: { changedIds: [] } });
    expect(k.tx.sponsor.update).not.toHaveBeenCalled();
    expect(k.audit.record).not.toHaveBeenCalled();
    expect(k.revalidation.enqueue).not.toHaveBeenCalled();
  });
});
