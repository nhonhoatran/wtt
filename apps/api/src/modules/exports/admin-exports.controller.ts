import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { EntriesExportService } from './entries-export.service.js';

const entriesQuery = z.object({ eventId: z.string().uuid(), subEventId: z.string().uuid().optional() });

@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly entries: EntriesExportService) {}

  @Get('entries')
  @RequirePermission('tournaments', 'list')
  async entriesSheet(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    const { eventId, subEventId } = parseBody(entriesQuery, raw);
    await this.entries.stream(eventId, subEventId, res);
  }
}
