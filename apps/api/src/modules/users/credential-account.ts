import { randomUUID } from 'node:crypto';
import type { Prisma } from '@kamito/db';

/** Better Auth's email+password provider id; sign-in looks the hash up under it. */
export const CREDENTIAL_PROVIDER_ID = 'credential';

type AccountWriter = Pick<Prisma.TransactionClient, 'account'>;

/** Writes the scrypt hash the way Better Auth's sign-up would, so its sign-in can verify it. */
export async function setCredentialPassword(tx: AccountWriter, userId: string, passwordHash: string): Promise<void> {
  const { count } = await tx.account.updateMany({
    where: { userId, providerId: CREDENTIAL_PROVIDER_ID },
    data: { password: passwordHash },
  });
  if (count > 0) return;
  await tx.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      userId,
      password: passwordHash,
    },
  });
}
