import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Put, Req } from '@nestjs/common';
import { APP_SETTING_GROUPS } from '@kamito/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { AppSettingsService } from './app-settings.service.js';

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

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
    await this.settings.update(def, parsed.value, requireAuthContext(req).user.id);
    return { data: { key, value: parsed.value } };
  }

  @Delete(':key')
  @HttpCode(200)
  @RequirePermission('settings', 'update')
  async reset(@Param('key') key: string) {
    const def = this.requireDefinition(key);
    await this.settings.reset(def);
    return { data: { key, value: def.defaultValue } };
  }

  private requireDefinition(key: string) {
    const def = this.settings.findEditable(key);
    if (!def) throw new NotFoundException({ code: 'SETTING_NOT_FOUND', message: 'Unknown setting' });
    return def;
  }
}
