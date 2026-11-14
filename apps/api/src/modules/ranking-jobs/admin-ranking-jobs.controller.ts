import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { RankingEnqueueService } from './ranking-enqueue.service.js';
import { RankingRecomputeRequestService } from './ranking-recompute-request.service.js';

const recomputeBody = z
  .object({ subEventId: z.string().uuid().optional(), eventTypeId: z.string().uuid().optional() })
  .refine((body) => Number(Boolean(body.subEventId)) + Number(Boolean(body.eventTypeId)) === 1, 'Chọn một nội dung thi đấu hoặc một hạng giải');

@Controller('admin/ranking')
export class AdminRankingJobsController {
  constructor(
    private readonly recompute: RankingRecomputeRequestService,
    private readonly enqueuer: RankingEnqueueService,
  ) {}

  @Post('recompute')
  @HttpCode(202)
  @RequirePermission('rankings', 'manage')
  async request(@Body() body: unknown) {
    const parsed = parseBody(recomputeBody, body);
    return this.recompute.request(parsed.subEventId ? { subEventId: parsed.subEventId } : { eventTypeId: parsed.eventTypeId as string });
  }

  @Get('jobs/:id')
  @RequirePermission('rankings', 'read')
  async job(@Param('id') id: string) {
    return { data: await this.enqueuer.jobStatus(id) };
  }
}
