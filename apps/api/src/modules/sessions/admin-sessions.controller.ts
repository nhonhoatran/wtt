import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createSessionBody, updateSessionBody } from './session-dtos.js';
import { SessionsService } from './sessions.service.js';

@Controller('admin/events/:eventId/sessions')
export class AdminSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  list(@Param('eventId') eventId: string) {
    return this.sessions.list(eventId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tournaments', 'create')
  create(@Param('eventId') eventId: string, @Body() body: unknown) {
    return this.sessions.create(eventId, parseBody(createSessionBody, body));
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  update(@Param('eventId') eventId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.sessions.update(eventId, id, parseBody(updateSessionBody, body));
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.sessions.remove(eventId, id);
  }
}
