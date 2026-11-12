import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { dbConnection } from '../auth/auth-env.js';
import { PrismaClient } from '../generated/prisma/client.js';

export const DATABASE_URL_TOKEN = 'DATABASE_URL_TOKEN';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(DATABASE_URL_TOKEN) databaseUrl: string) {
    const { connectionString, schema } = dbConnection(databaseUrl);
    super({ adapter: new PrismaPg({ connectionString }, { schema }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
