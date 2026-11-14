import { Body, Controller, Param, Patch } from '@nestjs/common';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { scheduleMatchBody } from './scheduling-dtos.js';
import { SchedulingService } from './scheduling.service.js';

@Controller('admin/matches')
export class AdminSchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  // Gated by tournaments.update, not matches.update: RESULTS_OPERATOR enters scores but must not move the schedule.
  @Patch(':id/schedule')
  @RequirePermission('tournaments', 'update')
  schedule(@Param('id') id: string, @Body() body: unknown) {
    return this.scheduling.schedule(id, parseBody(scheduleMatchBody, body));
  }
}
