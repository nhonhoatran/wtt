import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { AuditActorType, createPrismaClient } from '@kamito/db';
import { appSettingRegistry, resolveAppSetting, safeErrorSummary } from '@kamito/shared';
import { hashPassword } from 'better-auth/crypto';
import { setCredentialPassword } from '../modules/users/credential-account.js';
import { ask, askHidden } from './terminal-prompts.js';

/**
 * Creates the first ADMIN, or restores ADMIN access to an existing account. No default account
 * exists in code. Usage: create-admin --email you@example.com --name "Full name"
 */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
  const email = values.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('--email is required');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const target = new URL(databaseUrl);
  const databaseName = target.pathname.replace(/^\//, '');
  console.log(`DB target: ${target.hostname}:${target.port || '5432'}/${databaseName} (user: ${target.username})`);
  if ((await ask(`Type the database name (${databaseName}) to continue: `)) !== databaseName) {
    throw new Error('Not confirmed');
  }

  const prisma = createPrismaClient({ connectionString: databaseUrl });
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && (await ask(`${email} exists. Make it an active ADMIN and set a new password? (yes/no): `)) !== 'yes') {
      throw new Error('Not confirmed');
    }
    const name = values.name?.trim() || (existing ? undefined : email.split('@')[0]);

    const minRow = await prisma.appSetting.findUnique({ where: { key: appSettingRegistry.passwordMinLength.key } });
    const minLength = resolveAppSetting(appSettingRegistry.passwordMinLength, minRow?.value);
    const password = await askHidden(`Password (min ${minLength} characters): `);
    if (password.length < minLength) throw new Error(`Password must be at least ${minLength} characters`);
    if ((await askHidden('Repeat password: ')) !== password) throw new Error('Passwords do not match');
    const hash = await hashPassword(password);

    const id = existing?.id ?? randomUUID();
    await prisma.$transaction(async (tx) => {
      const state = { role: 'ADMIN' as const, isActive: true, mustChangePassword: false, tempPasswordExpiresAt: null };
      await tx.user.upsert({
        where: { email },
        create: { id, email, name: name ?? email, ...state },
        update: { ...state, ...(name && { name }) },
      });
      await setCredentialPassword(tx, id, hash);
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.SYSTEM,
          actorId: 'system',
          action: existing ? 'user.admin.restore.cli' : 'user.admin.create.cli',
          entity: 'User',
          entityId: id,
        },
      });
    });
    console.log(`${existing ? 'Restored' : 'Created'} ADMIN ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ msg: 'admin CLI failed', err: safeErrorSummary(error) }));
  process.exit(1);
});
