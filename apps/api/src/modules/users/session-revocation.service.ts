import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { PrismaService } from '../prisma/prisma.service.js';

type SessionWriter = Pick<Prisma.TransactionClient, 'session'>;

/** Better Auth's cookie cache is off, so deleting rows signs the user out on their next request. */
@Injectable()
export class SessionRevocationService {
  constructor(private readonly prisma: PrismaService) {}

  async revokeAll(userId: string, tx: SessionWriter = this.prisma): Promise<number> {
    const { count } = await tx.session.deleteMany({ where: { userId } });
    return count;
  }
}
