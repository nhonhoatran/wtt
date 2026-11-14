import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { MatchSheetsService } from './match-sheets.service.js';

const sheetsQuery = z.object({ sessionId: z.string().uuid().optional(), tableId: z.string().uuid().optional() });

@Controller('admin/events')
export class AdminMatchSheetsController {
  constructor(private readonly sheets: MatchSheetsService) {}

  @Get(':eventId/match-sheets')
  @RequirePermission('matches', 'list')
  list(@Param('eventId') eventId: string, @Query() raw: Record<string, unknown>) {
    return this.sheets.forEvent(eventId, parseBody(sheetsQuery, raw));
  }
}
