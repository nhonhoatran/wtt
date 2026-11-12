import { Inject, Injectable } from '@nestjs/common';
import { listSettings } from '@kamito/shared';
import { AppSettingsService } from '../../modules/settings/app-settings.service.js';
import { API_ENV } from '../config/app-config.module.js';
import type { ApiEnv } from '../config/env-schema.js';
import type { PaginationLimits } from './pagination-query.js';

/** Default page size comes from /settings; env keeps the safety ceilings. */
@Injectable()
export class PaginationLimitsService {
  constructor(
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async defaultPageSize(): Promise<number> {
    return Math.min(await this.settings.get(listSettings.defaultPageSize), this.env.PAGINATION_MAX_PAGE_SIZE);
  }

  async limits(): Promise<PaginationLimits> {
    return {
      defaultPageSize: await this.defaultPageSize(),
      maxPageSize: this.env.PAGINATION_MAX_PAGE_SIZE,
      maxQueryLength: this.env.QUERY_MAX_LENGTH,
    };
  }
}
