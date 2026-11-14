import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { createIntentBody, updateMediaBody } from './media-dtos.js';
import { MediaService } from './media.service.js';

@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Post('intents')
  @RequirePermission('media', 'create')
  async createIntent(@Body() body: unknown, @Req() req: Request) {
    return { data: await this.media.createIntent(requireAuthContext(req).user.id, parseBody(createIntentBody, body)) };
  }

  // Raw image body; Nest's JSON/urlencoded parsers skip image/* so the stream stays unread until here.
  @Put(':id/content')
  @RequirePermission('media', 'create')
  async upload(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { data: await this.media.receiveContent(requireAuthContext(req).user.id, id, req, res) };
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermission('media', 'create')
  async complete(@Param('id') id: string, @Req() req: Request) {
    return { data: await this.media.complete(requireAuthContext(req).user.id, id) };
  }

  @Get('config')
  @RequirePermission('media', 'read')
  async config() {
    return { data: await this.media.uploadConfig() };
  }

  @Get(':id')
  @RequirePermission('media', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.media.get(id) };
  }

  @Patch(':id')
  @RequirePermission('media', 'update')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.media.update(requireAuthContext(req).user.id, id, parseBody(updateMediaBody, body));
  }
}
