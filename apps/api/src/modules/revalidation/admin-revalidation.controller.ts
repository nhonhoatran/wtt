import { Controller, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../access-control/access-decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from './cache-tags.js';
import { loadEventMatchNos, loadEventPlayerSlugs, loadSubEventCodes } from './public-tag-context.js';
import { RevalidationEnqueueService } from './revalidation-enqueue.service.js';

@Controller('admin/events')
export class AdminRevalidationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  /** "Refresh public pages": invalidates every public tag of the event, for when a refresh was lost or content changed out of band. */
  @Post(':id/revalidate')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  async refresh(@Param('id') id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { slug: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    const warnings = await this.revalidation.enqueue(async () =>
      CACHE_TAGS['event.refresh']({
        eventSlugs: [event.slug],
        subEventCodes: await loadSubEventCodes(this.prisma, id),
        matchNos: await loadEventMatchNos(this.prisma, id),
        playerSlugs: await loadEventPlayerSlugs(this.prisma, id),
      }),
    );
    return { data: { id }, ...(warnings.length > 0 && { warnings }) };
  }
}
