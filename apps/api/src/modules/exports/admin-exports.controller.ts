import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { EntriesExportService } from './entries-export.service.js';
import { ResultsExportService } from './results-export.service.js';
import { ScheduleExportService } from './schedule-export.service.js';

const entriesQuery = z.object({ eventId: z.string().uuid(), subEventId: z.string().uuid().optional() });
const eventQuery = z.object({ eventId: z.string().uuid() });

@Controller('admin/exports')
export class AdminExportsController {
  constructor(
    private readonly entries: EntriesExportService,
    private readonly schedule: ScheduleExportService,
    private readonly results: ResultsExportService,
  ) {}

  @Get('entries')
  @RequirePermission('tournaments', 'list')
  async entriesSheet(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    const { eventId, subEventId } = parseBody(entriesQuery, raw);
    await this.entries.stream(eventId, subEventId, res);
  }

  @Get('schedule')
  @RequirePermission('tournaments', 'list')
  async scheduleSheet(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    await this.schedule.stream(parseBody(eventQuery, raw).eventId, res);
  }

  @Get('results')
  @RequirePermission('tournaments', 'list')
  async resultsSheet(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    await this.results.stream(parseBody(eventQuery, raw).eventId, res);
  }
}
