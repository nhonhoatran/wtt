import { Body, Controller, Inject, Delete, Get, HttpCode, NotFoundException, Param, Put, Req } from '@nestjs/common';
import { APP_SETTING_GROUPS } from '@kamito/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { AppSettingsService } from './app-settings.service.js';
import { assertWithinEnvCeiling } from './setting-ceilings.js';

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: AppSettingsService,
    private readonly revalidation: RevalidationEnqueueService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Get()
  @RequirePermission('settings', 'read')
  async list() {
    return { data: await this.settings.listEditable(), groups: APP_SETTING_GROUPS };
  }

  @Put(':key')
  @RequirePermission('settings', 'update')
  async update(@Param('key') key: string, @Body() body: unknown, @Req() req: Request) {
    const def = this.requireDefinition(key);
    const parsed = parseBody(z.object({ value: def.schema }), body);
    assertWithinEnvCeiling(key, parsed.value, this.env);
    await this.settings.update(def, parsed.value, requireAuthContext(req).user.id);
    return this.withRefresh({ data: { key, value: parsed.value } });
  }

  @Delete(':key')
  @HttpCode(200)
  @RequirePermission('settings', 'update')
  async reset(@Param('key') key: string) {
    const def = this.requireDefinition(key);
    await this.settings.reset(def);
    return this.withRefresh({ data: { key, value: def.defaultValue } });
  }

  /** Public pages cache some settings; invalidate them after the database write shared by all API replicas. */
  private async withRefresh<T extends object>(result: T) {
    const warnings = await this.revalidation.enqueue(() => CACHE_TAGS['settings.update']());
    return warnings.length > 0 ? { ...result, warnings } : result;
  }

  private requireDefinition(key: string) {
    const def = this.settings.findEditable(key);
    if (!def) throw new NotFoundException({ code: 'SETTING_NOT_FOUND', message: 'Unknown setting' });
    return def;
  }
}
