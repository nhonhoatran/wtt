import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { UserRoleName } from '@kamito/shared';
import { hashPassword } from 'better-auth/crypto';
import request from 'supertest';
import { createApiApp } from '../../src/bootstrap-app.js';
import { API_ENV } from '../../src/common/config/app-config.module.js';
import type { ApiEnv } from '../../src/common/config/env-schema.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { setCredentialPassword } from '../../src/modules/users/credential-account.js';

export const SIGN_IN = '/api/v1/auth/sign-in/email';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export interface CreateTestUserOptions {
  role?: UserRoleName;
  isActive?: boolean;
  mustChangePassword?: boolean;
  tempPasswordExpiresAt?: Date | null;
}

/** One app per spec file; X-Forwarded-For is trusted for one hop so each test can act from its own IP. */
export class AuthTestKit {
  readonly app: INestApplication;
  readonly prisma: PrismaService;
  readonly origin: string;
  private readonly userIds: string[] = [];

  private constructor(app: INestApplication) {
    this.app = app;
    this.prisma = app.get(PrismaService);
    this.origin = new URL(app.get<ApiEnv>(API_ENV).ADMIN_PUBLIC_URL).origin;
  }

  static async start(): Promise<AuthTestKit> {
    process.env.TRUST_PROXY_HOPS = '1';
    const app = await createApiApp();
    await app.init();
    return new AuthTestKit(app);
  }

  get http() {
    return request(this.app.getHttpServer());
  }

  async createUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
    const id = randomUUID();
    const email = `e2e-${id.slice(0, 8)}@test.kamito.local`;
    const password = `Pw-${randomUUID()}`;
    await this.prisma.user.create({
      data: {
        id,
        email,
        name: `E2E ${id.slice(0, 4)}`,
        role: options.role ?? 'RESULTS_OPERATOR',
        isActive: options.isActive ?? true,
        mustChangePassword: options.mustChangePassword ?? false,
        tempPasswordExpiresAt: options.tempPasswordExpiresAt ?? null,
      },
    });
    await setCredentialPassword(this.prisma, id, await hashPassword(password));
    this.userIds.push(id);
    return { id, email, password };
  }

  track(userId: string): void {
    this.userIds.push(userId);
  }

  signInRequest(email: string, password: string, ip = randomIp()) {
    return this.http
      .post(SIGN_IN)
      .set('Origin', this.origin)
      .set('X-Forwarded-For', ip)
      .send({ email, password });
  }

  /** Returns the Cookie header value for the new session. */
  async signIn(user: Pick<TestUser, 'email' | 'password'>, ip = randomIp()): Promise<string> {
    const res = await this.signInRequest(user.email, user.password, ip);
    if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
    return sessionCookie(res.headers['set-cookie']);
  }

  get(path: string, cookie?: string) {
    const req = this.http.get(path);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  write(method: 'post' | 'patch' | 'put' | 'delete', path: string, cookie?: string, body: object = {}) {
    const req = this.http[method](path).set('Origin', this.origin).send(body);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  async close(): Promise<void> {
    if (this.userIds.length) {
      await this.prisma.auditLog.deleteMany({ where: { entityId: { in: this.userIds } } });
      await this.prisma.auditLog.deleteMany({ where: { actorId: { in: this.userIds } } });
      await this.prisma.user.deleteMany({ where: { id: { in: this.userIds } } });
    }
    await this.app.close();
  }
}

export function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

export function sessionCookie(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = list.find((value) => value.includes('session_token='));
  if (!cookie) throw new Error('no session cookie in response');
  return cookie.split(';')[0]!;
}
