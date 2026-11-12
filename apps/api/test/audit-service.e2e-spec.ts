import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../src/bootstrap-app.js';
import { AuditService, SYSTEM_ACTOR_ID } from '../src/common/audit/audit.service.js';
import { runWithRequestContext } from '../src/common/audit/request-context.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('AuditService (real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const entityId = `test-${randomUUID()}`;

  beforeAll(async () => {
    app = await createApiApp();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId } });
    await app.close();
  });

  it('records a system action with PII masked', async () => {
    await app.get(AuditService).record({
      action: 'player.update',
      entity: 'Player',
      entityId,
      before: { name: 'An', phone: '0901234567' },
      after: { name: 'An', phone: '0907654321', guardian: { email: 'x@y.z' } },
    });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId } });
    expect(row.actorType).toBe('SYSTEM');
    expect(row.actorId).toBe(SYSTEM_ACTOR_ID);
    expect(row.before).toEqual({ name: 'An', phone: '***' });
    expect(row.after).toEqual({ name: 'An', phone: '***', guardian: { email: '***' } });
  });

  it('takes actor and request metadata from the request context', async () => {
    const context = { requestId: 'req-1', ip: '203.0.113.9', userAgent: 'vitest', sessionId: 's-1', userId: 'u-1' };
    await runWithRequestContext(context, () =>
      app.get(AuditService).record({ action: 'match.result.confirm', entity: 'Match', entityId, reason: 'test' }),
    );
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId, action: 'match.result.confirm' } });
    expect(row).toMatchObject({ actorType: 'USER', actorId: 'u-1', ip: '203.0.113.9', requestId: 'req-1', sessionId: 's-1' });
  });
});
