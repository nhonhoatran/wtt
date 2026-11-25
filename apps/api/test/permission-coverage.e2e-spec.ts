import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IS_PUBLIC, REQUIRED_PERMISSION, REQUIRES_SESSION } from '../src/modules/access-control/access-decorators.js';
import { AuthTestKit } from './support/auth-test-kit.js';

// Nest's own metadata keys for @Get/@Post..., from @nestjs/common/constants.
const NEST_METHOD_METADATA = 'method';
const NEST_PATH_METADATA = 'path';

interface RouteRule {
  route: string;
  rule: 'public' | 'session' | 'permission' | 'none';
}

function collectRoutes(container: ModulesContainer): RouteRule[] {
  const routes: RouteRule[] = [];
  for (const moduleRef of container.values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controller) continue;
      const base = Reflect.getMetadata(NEST_PATH_METADATA, controller) as string;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        if (Reflect.getMetadata(NEST_METHOD_METADATA, handler) === undefined) continue;
        const has = (key: string) => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
        const rule = has(IS_PUBLIC) ? 'public' : has(REQUIRED_PERMISSION) ? 'permission' : has(REQUIRES_SESSION) ? 'session' : 'none';
        routes.push({ route: `${controller.name}.${name} (${base}/${Reflect.getMetadata(NEST_PATH_METADATA, handler)})`, rule });
      }
    }
  }
  return routes;
}

describe('permission coverage', () => {
  let kit: AuthTestKit;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
  });

  afterAll(async () => {
    await kit.close();
  });

  it('every Nest route declares @Public, @RequireSession or @RequirePermission', () => {
    const routes = collectRoutes(kit.app.get(ModulesContainer));
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.filter((route) => route.rule === 'none')).toEqual([]);
    const publicRoutes = routes.filter((route) => route.rule === 'public').map((route) => route.route);
    expect(publicRoutes.filter((route) => !['(health/', '(media/public/', '(public/'].some((prefix) => route.includes(prefix)))).toEqual([]);
  });

  it('RESULTS_OPERATOR gets 403 on every ADMIN-only group that has endpoints', async () => {
    const operator = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    const cookie = await kit.signIn(operator);
    for (const path of ['/api/v1/admin/users', '/api/v1/admin/audit-logs', '/api/v1/admin/settings', '/api/v1/admin/queues', '/api/v1/admin/ranking-lists', '/api/v1/admin/ranking-points', '/api/v1/admin/ranking-snapshots']) {
      expect({ path, status: (await kit.get(path, cookie)).status }).toEqual({ path, status: 403 });
    }
    await kit.write('post', '/api/v1/admin/users', cookie, { email: 'x@test.kamito.local', name: 'x' }).expect(403);
    await kit.write('put', '/api/v1/admin/ranking-rules/matrix', cookie, {}).expect(403);
    await kit.write('post', '/api/v1/admin/ranking/recompute', cookie, {}).expect(403);
    await kit.write('put', '/api/v1/admin/settings/auth.stepUp.ttlMinutes', cookie, { value: 30 }).expect(403);
  });

  it('every /admin route is gated by a permission, not only by a session', () => {
    const adminRoutes = collectRoutes(kit.app.get(ModulesContainer)).filter((route) => route.route.includes('(admin/'));
    expect(adminRoutes.length).toBeGreaterThanOrEqual(10);
    expect(adminRoutes.filter((route) => route.rule !== 'permission')).toEqual([]);
  });

  it('ADMIN can read, validate, change and reset a /settings value, with audit', async () => {
    const admin = await kit.createUser({ role: 'ADMIN' });
    const cookie = await kit.signIn(admin);
    const key = 'auth.stepUp.ttlMinutes';
    const original = await kit.prisma.appSetting.findUnique({ where: { key } });
    try {
      const list = await kit.get('/api/v1/admin/settings', cookie).expect(200);
      const item = list.body.data.find((setting: { key: string }) => setting.key === key);
      expect(item).toMatchObject({ group: 'auth', editor: { kind: 'number', min: 1, max: 60 } });
      expect(list.body.data.find((setting: { key: string }) => setting.key === 'site.name')).toMatchObject({ group: 'display', editor: { kind: 'bilingual-text', nullable: false } });

      const invalid = await kit.write('put', `/api/v1/admin/settings/${key}`, cookie, { value: 0 }).expect(422);
      expect(invalid.body.error.fields).toHaveProperty('value');
      await kit.write('put', '/api/v1/admin/settings/no.such.key', cookie, { value: 1 }).expect(404);

      await kit.write('put', `/api/v1/admin/settings/${key}`, cookie, { value: 7 }).expect(200);
      expect((await kit.prisma.appSetting.findUnique({ where: { key } }))?.value).toBe(7);
      await kit.write('delete', `/api/v1/admin/settings/${key}`, cookie).expect(200);
      expect(await kit.prisma.appSetting.findUnique({ where: { key } })).toBeNull();
      const audits = await kit.prisma.auditLog.findMany({ where: { entityId: key, actorId: admin.id } });
      expect(audits.map((row) => row.action).sort()).toEqual(['setting.reset', 'setting.update']);
    } finally {
      if (original) {
        await kit.prisma.appSetting.upsert({
          where: { key },
          create: { key, value: original.value as never, updatedById: original.updatedById },
          update: { value: original.value as never },
        });
      }
      await kit.prisma.auditLog.deleteMany({ where: { entityId: key, actorId: admin.id } });
    }
  });
});
