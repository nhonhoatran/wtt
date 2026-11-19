import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { articleBody, contactStatusBody, sponsorBody, staticPageBody, updateSponsorBody, videoBody } from './admin-content-dtos.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { contentSettings } from '@kamito/shared';
import { ContentErrorsInterceptor } from './content-errors.interceptor.js';
import { ContentWritesService } from './content-writes.service.js';
import { SponsorOrderService } from './sponsor-order.service.js';
import { reorderSponsorsBody } from './sponsor-order.js';

const pageRules = (sortable: readonly string[], filterable: readonly string[] = ['status']) => ({ sortable, filterable });
const articleListRules = pageRules(['title', 'publishedAt', 'createdAt'], ['status', 'category', 'eventId']);
const videoListRules = pageRules(['title', 'publishedAt', 'createdAt'], ['status', 'eventId']);
const sponsorListRules = pageRules(['name', 'order', 'createdAt'], ['eventId', 'isActive']);
const pageListRules = pageRules(['title', 'footerOrder', 'updatedAt', 'createdAt'], ['status']);
const contactListRules = pageRules(['createdAt', 'status'], ['status']);

@Controller('admin')
@UseInterceptors(ContentErrorsInterceptor)
export class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationLimitsService,
    private readonly settings: AppSettingsService,
    private readonly writes: ContentWritesService,
    private readonly sponsorOrder: SponsorOrderService,
  ) {}

  @Get('articles')
  @RequirePermission('content', 'list')
  async articles(@Query() raw: Record<string, unknown>) {
    const q = parsePaginationQuery(raw, articleListRules, await this.pagination.limits());
    const where = { ...(q.filter.status ? { status: q.filter.status as never } : {}), ...(q.filter.category ? { category: q.filter.category } : {}), ...(q.filter.eventId ? { events: { some: { eventId: q.filter.eventId } } } : {}), ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' as const } }, { summary: { contains: q.q, mode: 'insensitive' as const } }] } : {}) };
    const [data, total] = await Promise.all([this.prisma.article.findMany({ where, orderBy: q.sort ? { [q.sort.field]: q.sort.direction } : { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { events: { include: { event: { select: { id: true, name: true, slug: true } } } } } }), this.prisma.article.count({ where })]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('articles/:id')
  @RequirePermission('content', 'read')
  async article(@Param('id') id: string) { return { data: await this.prisma.article.findUniqueOrThrow({ where: { id }, include: { events: { select: { eventId: true } } } }) }; }

  @Post('articles')
  @RequirePermission('content', 'create')
  async createArticle(@Body() body: unknown) {
    const input = parseBody(articleBody, body);
    await this.validateArticleCategory(input.category ?? null);
    return this.writes.createArticle(input);
  }

  @Patch('articles/:id')
  @RequirePermission('content', 'update')
  async updateArticle(@Param('id') id: string, @Body() body: unknown) {
    const input = parseBody(articleBody, body);
    await this.validateArticleCategory(input.category ?? null);
    return this.writes.updateArticle(id, input);
  }

  @Delete('articles/:id')
  @RequirePermission('content', 'delete')
  async deleteArticle(@Param('id') id: string) { return this.writes.deleteArticle(id); }

  @Get('videos')
  @RequirePermission('content', 'list')
  async videos(@Query() raw: Record<string, unknown>) {
    const q = parsePaginationQuery(raw, videoListRules, await this.pagination.limits());
    const where = { ...(q.filter.status ? { status: q.filter.status as never } : {}), ...(q.filter.eventId ? { eventId: q.filter.eventId } : {}), ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const [data, total] = await Promise.all([this.prisma.video.findMany({ where, orderBy: q.sort ? { [q.sort.field]: q.sort.direction } : { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), this.prisma.video.count({ where })]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('videos/:id')
  @RequirePermission('content', 'read')
  async video(@Param('id') id: string) { return { data: await this.prisma.video.findUniqueOrThrow({ where: { id } }) }; }

  @Post('videos')
  @RequirePermission('content', 'create')
  async createVideo(@Body() body: unknown) { return this.writes.saveVideo(parseBody(videoBody, body)); }

  @Patch('videos/:id')
  @RequirePermission('content', 'update')
  async updateVideo(@Param('id') id: string, @Body() body: unknown) { return this.writes.saveVideo(parseBody(videoBody, body), id); }

  @Delete('videos/:id')
  @RequirePermission('content', 'delete')
  async deleteVideo(@Param('id') id: string) { return this.writes.deleteVideo(id); }

  @Get('sponsors')
  @RequirePermission('sponsors', 'list')
  async sponsors(@Query() raw: Record<string, unknown>) {
    const q = parsePaginationQuery(raw, sponsorListRules, await this.pagination.limits());
    const where = { ...(q.filter.eventId ? { eventId: q.filter.eventId } : {}), ...(q.filter.isActive ? { isActive: q.filter.isActive === 'true' } : {}), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const [data, total] = await Promise.all([this.prisma.sponsor.findMany({ where, orderBy: q.sort ? [{ [q.sort.field]: q.sort.direction }, ...(q.sort.field === 'order' ? [{ name: 'asc' as const }] : []), { id: 'asc' }] : [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }), this.prisma.sponsor.count({ where })]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('sponsors/:id')
  @RequirePermission('sponsors', 'read')
  async sponsor(@Param('id') id: string) { return { data: await this.prisma.sponsor.findUniqueOrThrow({ where: { id } }) }; }

  @Post('sponsors/reorder')
  @RequirePermission('sponsors', 'update')
  async reorderSponsors(@Body() body: unknown) { return this.sponsorOrder.reorder(parseBody(reorderSponsorsBody, body)); }

  @Post('sponsors')
  @RequirePermission('sponsors', 'create')
  async createSponsor(@Body() body: unknown) { return this.writes.createSponsor(parseBody(sponsorBody, body)); }

  @Patch('sponsors/:id')
  @RequirePermission('sponsors', 'update')
  async updateSponsor(@Param('id') id: string, @Body() body: unknown) { return this.writes.updateSponsor(id, parseBody(updateSponsorBody, body)); }

  @Delete('sponsors/:id')
  @RequirePermission('sponsors', 'delete')
  async deleteSponsor(@Param('id') id: string) { return this.writes.deleteSponsor(id); }

  @Get('static-pages')
  @RequirePermission('content', 'list')
  async pages(@Query() raw: Record<string, unknown>) {
    const q = parsePaginationQuery(raw, pageListRules, await this.pagination.limits());
    const where = { ...(q.filter.status ? { status: q.filter.status as never } : {}), ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const [data, total] = await Promise.all([this.prisma.staticPage.findMany({ where, orderBy: q.sort ? { [q.sort.field]: q.sort.direction } : { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), this.prisma.staticPage.count({ where })]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('static-pages/:id')
  @RequirePermission('content', 'read')
  async page(@Param('id') id: string) { return { data: await this.prisma.staticPage.findUniqueOrThrow({ where: { id } }) }; }

  @Post('static-pages')
  @RequirePermission('content', 'create')
  async createPage(@Body() body: unknown) { return this.writes.savePage(parseBody(staticPageBody, body)); }

  @Patch('static-pages/:id')
  @RequirePermission('content', 'update')
  async updatePage(@Param('id') id: string, @Body() body: unknown) { return this.writes.savePage(parseBody(staticPageBody, body), id); }

  @Delete('static-pages/:id')
  @RequirePermission('content', 'delete')
  async deletePage(@Param('id') id: string) { return this.writes.deletePage(id); }

  @Get('contact-messages')
  @RequirePermission('content', 'list')
  async contacts(@Query() raw: Record<string, unknown>) {
    const q = parsePaginationQuery(raw, contactListRules, await this.pagination.limits());
    const where = { ...(q.filter.status ? { status: q.filter.status as never } : {}), ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q, mode: 'insensitive' as const } }, { organization: { contains: q.q, mode: 'insensitive' as const } }] } : {}) };
    const [data, total] = await Promise.all([this.prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, name: true, email: true, phone: true, organization: true, message: true, status: true, createdAt: true } }), this.prisma.contactMessage.count({ where })]);
    return { data, total, page: q.page, pageSize: q.pageSize, newCount: await this.prisma.contactMessage.count({ where: { status: 'NEW' } }) };
  }

  @Get('contact-messages/:id')
  @RequirePermission('content', 'read')
  async contact(@Param('id') id: string) {
    return { data: await this.prisma.contactMessage.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, email: true, phone: true, organization: true, message: true, status: true, createdAt: true } }) };
  }

  @Patch('contact-messages/:id')
  @RequirePermission('content', 'update')
  async updateContact(@Param('id') id: string, @Body() body: unknown) { return this.writes.updateContact(id, parseBody(contactStatusBody, body)); }

  private async validateArticleCategory(category: string | null): Promise<void> {
    if (category === null) return;
    const categories = await this.settings.get(contentSettings.newsCategories);
    if (!categories.includes(category)) throw new BadRequestException({ code: 'INVALID_CATEGORY', fields: { category: 'Chuyên mục không hợp lệ' } });
  }
}
