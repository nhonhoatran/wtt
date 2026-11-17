import { Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { rankingToday } from '../ranking-jobs/ranking-today.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { impactQuery, matrixQuery, saveMatrixBody } from './ranking-rule-dtos.js';
import { RankingRulesQueryService } from './ranking-rules-query.service.js';
import { RankingRulesSaveService } from './ranking-rules-save.service.js';

@Controller('admin/ranking-rules')
export class AdminRankingRulesController {
  constructor(
    private readonly queries: RankingRulesQueryService,
    private readonly saves: RankingRulesSaveService,
    private readonly settings: AppSettingsService,
  ) {}

  @Get()
  @RequirePermission('rankings', 'list')
  async matrix(@Query() raw: Record<string, unknown>) {
    const query = parseBody(matrixQuery, raw);
    return {
      data: await this.queries.matrix({
        competitorKind: query['filter[competitorKind]'],
        drawKind: query['filter[drawKind]'],
        asOf: query['filter[asOf]'] ?? (await rankingToday(this.settings)),
      }),
    };
  }

  @Get('impact')
  @RequirePermission('rankings', 'list')
  async impact(@Query() raw: Record<string, unknown>) {
    return { data: await this.queries.impact(parseBody(impactQuery, raw)) };
  }

  @Put('matrix')
  @RequirePermission('rankings', 'update')
  async save(@Body() body: unknown, @Req() req: Request) {
    return this.saves.save(parseBody(saveMatrixBody, body), requireAuthContext(req).user.id);
  }
}
