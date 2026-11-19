import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { APIRequestContext } from '@playwright/test';
import type { ContentWorld } from './content-fixture';
import { expect } from './fixtures';

/** Uses the real sign-in endpoint with a temporary user; credentials never leave this process. */
export async function withContentAdmin(cms: ContentWorld, request: APIRequestContext, run: (cookie: string) => Promise<void>): Promise<void> {
  const id = randomUUID();
  const password = `Pw-${randomUUID()}`;
  const email = `${cms.tag}-admin@test.kamito.local`;
  const requireApi = createRequire(path.resolve(import.meta.dirname, '../../../../api/package.json'));
  const { hashPassword } = await import(pathToFileURL(requireApi.resolve('better-auth/crypto')).href) as { hashPassword: (value: string) => Promise<string> };
  await cms.db.user.create({ data: {
    id, email, name: `CMS browser admin ${cms.tag}`, role: 'ADMIN',
    accounts: { create: { id: randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(password) } },
  } });
  try {
    const api = process.env.API_INTERNAL_URL!.replace(/\/+$/, '');
    const signIn = await request.post(`${api}/api/v1/auth/sign-in/email`, {
      headers: { Origin: new URL(process.env.ADMIN_PUBLIC_URL!).origin }, data: { email, password },
    });
    expect(signIn.status()).toBe(200);
    const cookie = signIn.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value.split(';')[0]!).find((value) => value.includes('session_token='));
    if (!cookie) throw new Error('CMS admin sign-in did not return a session cookie');
    await run(cookie);
  } finally {
    await cms.db.auditLog.deleteMany({ where: { actorId: id } });
    await cms.db.auditLog.deleteMany({ where: { entityId: id } });
    await cms.db.user.deleteMany({ where: { id } });
  }
}
