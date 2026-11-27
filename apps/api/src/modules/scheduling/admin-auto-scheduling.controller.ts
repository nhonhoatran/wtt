import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { autoScheduleApplyBody, autoSchedulePreviewBody } from './auto-schedule-dtos.js';
import { AutoScheduleService } from './auto-schedule.service.js';

@Controller('admin/events/:eventId/auto-schedule')
export class AdminAutoSchedulingController {
  constructor(private readonly scheduling: AutoScheduleService) {}

  @Post('preview')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  preview(@Param('eventId') eventId: string, @Body() body: unknown) {
    return this.scheduling.preview(eventId, parseBody(autoSchedulePreviewBody, body));
  }

  @Post('apply')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  apply(@Param('eventId') eventId: string, @Body() body: unknown) {
    return this.scheduling.apply(eventId, parseBody(autoScheduleApplyBody, body));
  }
}
