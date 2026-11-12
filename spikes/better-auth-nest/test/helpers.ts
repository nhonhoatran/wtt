import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUTH_TOKEN } from '../src/auth/auth.guard.js';
import { AUTH_BASE_PATH } from '../src/auth/auth-env.js';
import type { Auth } from '../src/auth/create-auth.js';
import { createSpikeApp } from '../src/bootstrap-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const ORIGIN = process.env.BETTER_AUTH_URL ?? 'https://admin.spike.test';
export const AUTH = AUTH_BASE_PATH;
export const PASSWORD = 'Sup3r-Secret-Pass!';

export interface Ctx {
  app: INestApplication;
  auth: Auth;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

export async function bootApp(options: Parameters<typeof createSpikeApp>[0] = {}): Promise<Ctx> {
  const app = await createSpikeApp(options);
  await app.init();
  return {
    app,
    auth: app.get<Auth>(AUTH_TOKEN),
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
  };
}

const runOctet = (Date.now() % 250) + 1;
let ipCounter = 0;
/** Unique IP per call (and per run) so each test gets its own rate-limit bucket. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.${runOctet}.${(ipCounter % 250) + 1}`;
}

export function cookieHeader(setCookie: string[] | string | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list
    .map((c) => c.split(';')[0] ?? '')
    .filter((c) => !/=\s*$/.test(c))
    .join('; ');
}

export async function createUserDirect(
  ctx: Ctx,
  role: 'ADMIN' | 'RESULTS_OPERATOR',
  extra: { mustChangePassword?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@spike.test`;
  const hashed = await (await ctx.auth.$context).password.hash(PASSWORD);
  const id = randomUUID();
  await ctx.prisma.user.create({
    data: {
      id,
      name: email,
      email,
      role,
      mustChangePassword: extra.mustChangePassword ?? false,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: 'credential', password: hashed } },
    },
  });
  return { id, email };
}

export async function login(ctx: Ctx, email: string, password = PASSWORD, ip = freshIp()) {
  const res = await ctx
    .http()
    .post(`${AUTH}/sign-in/email`)
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', ip)
    .send({ email, password });
  return { res, cookie: cookieHeader(res.headers['set-cookie']) };
}

export function authed(ctx: Ctx, method: 'get' | 'post', path: string, cookie: string, ip = freshIp()) {
  return ctx.http()[method](path).set('Cookie', cookie).set('Origin', ORIGIN).set('X-Forwarded-For', ip);
}

export async function cleanupUsers(ctx: Ctx, ids: string[]): Promise<void> {
  await ctx.prisma.user.deleteMany({ where: { id: { in: ids } } });
}
