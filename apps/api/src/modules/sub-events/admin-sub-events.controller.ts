import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { bulkSubEventsBody, createSubEventBody, updateSubEventBody } from './sub-event-dtos.js';
import { SubEventsService } from './sub-events.service.js';

@Controller('admin/events/:eventId/sub-events')
export class AdminSubEventsController {
  constructor(private readonly subEvents: SubEventsService) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  list(@Param('eventId') eventId: string) {
    return this.subEvents.list(eventId);
  }

  @Post('bulk')
  @HttpCode(201)
  @RequirePermission('tournaments', 'create')
  bulkCreate(@Param('eventId') eventId: string, @Body() body: unknown) {
    return this.subEvents.bulkCreate(eventId, parseBody(bulkSubEventsBody, body));
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Param('eventId') eventId: string, @Body() body: unknown) {
    return { data: await this.subEvents.create(eventId, parseBody(createSubEventBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('eventId') eventId: string, @Param('id') id: string, @Body() body: unknown) {
    return { data: await this.subEvents.update(eventId, id, parseBody(updateSubEventBody, body)) };
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return { data: await this.subEvents.remove(eventId, id) };
  }
}
