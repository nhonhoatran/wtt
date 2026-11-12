import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { buildPrismaClientOptions, PrismaClient } from '@kamito/db';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(API_ENV) env: ApiEnv) {
    super(buildPrismaClientOptions({ connectionString: env.DATABASE_URL }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
