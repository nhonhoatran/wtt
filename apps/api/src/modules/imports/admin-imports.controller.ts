import { Body, Controller, NotFoundException, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { commitBody, createImportBody, decisionBody, templateQuery } from './import-dtos.js';
import { IMPORT_ROW_LIST_RULES, ImportRowsService } from './import-rows.service.js';
import { ImportTemplateService } from './import-template.service.js';
import { IMPORT_LIST_RULES, ImportsService, type Actor } from './imports.service.js';

const actorOf = (req: Request): Actor => {
  const { user } = requireAuthContext(req);
  return { id: user.id, role: user.role };
};

@Controller('admin/imports')
export class AdminImportsController {
  constructor(
    private readonly imports: ImportsService,
    private readonly rows: ImportRowsService,
    private readonly template: ImportTemplateService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get('template')
  @RequirePermission('tournaments', 'read')
  async downloadTemplate(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    await this.template.stream(parseBody(templateQuery, raw).eventId, res);
  }

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.imports.list(parsePaginationQuery(raw, IMPORT_LIST_RULES, await this.pagination.limits()));
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown, @Req() req: Request) {
    return { data: await this.imports.create(actorOf(req), parseBody(createImportBody, body)) };
  }

  // The xlsx body is raw: Nest's JSON/urlencoded parsers skip this content type, so the stream stays unread until here.
  @Put(':id/file')
  @RequirePermission('tournaments', 'create')
  async upload(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { data: await this.imports.receiveFile(actorOf(req), id, req, res) };
  }

  @Post(':id/uploaded')
  @HttpCode(200)
  @RequirePermission('tournaments', 'create')
  async uploaded(@Param('id') id: string, @Req() req: Request) {
    return { data: await this.imports.markUploaded(actorOf(req), id) };
  }

  @Post(':id/validate')
  @HttpCode(200)
  @RequirePermission('tournaments', 'create')
  async revalidate(@Param('id') id: string, @Req() req: Request) {
    return { data: await this.imports.revalidate(actorOf(req), id) };
  }

  @Post(':id/commit')
  @HttpCode(200)
  @RequirePermission('tournaments', 'create')
  async commit(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return { data: await this.imports.commit(actorOf(req), id, parseBody(commitBody, body)) };
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.imports.get(id) };
  }

  @Get(':id/rows')
  @RequirePermission('tournaments', 'read')
  async listRows(@Param('id') id: string, @Query() raw: Record<string, unknown>) {
    return this.rows.list(id, parsePaginationQuery(raw, IMPORT_ROW_LIST_RULES, await this.pagination.limits()));
  }

  @Patch(':id/rows/:rowNo')
  @RequirePermission('tournaments', 'create')
  async decide(@Param('id') id: string, @Param('rowNo') rowNo: string, @Body() body: unknown) {
    const number = Number(rowNo);
    if (!Number.isInteger(number) || number < 1) throw new NotFoundException({ code: 'IMPORT_ROW_NOT_FOUND', message: 'Không tìm thấy dòng' });
    return { data: await this.rows.decide(id, number, parseBody(decisionBody, body)) };
  }
}
