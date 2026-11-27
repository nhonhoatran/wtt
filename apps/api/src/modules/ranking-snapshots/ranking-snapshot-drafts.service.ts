import { Injectable } from '@nestjs/common';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { rankingToday } from '../ranking-jobs/ranking-today.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { CreateDraftsBody } from './ranking-snapshot-dtos.js';

@Injectable()
export class RankingSnapshotDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enqueuer: RankingEnqueueService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Queues one build-snapshot job per list; the worker recomputes dirty sub-events first. */
  async create(body: CreateDraftsBody) {
    const today = await rankingToday(this.settings);
    const asOfDate = body.asOfDate ?? today;
    if (asOfDate > today) throw fieldError('asOfDate', 'Ngày chốt không được ở tương lai');
    const lists = await this.prisma.rankingList.findMany({
      where: body.all ? { isActive: true } : { id: { in: body.listIds } },
      select: { id: true, code: true },
      orderBy: { order: 'asc' },
    });
    if (!lists.length) throw fieldError('listIds', 'Không có bảng xếp hạng nào để dựng bản nháp');
    if (body.listIds && lists.length !== new Set(body.listIds).size) throw fieldError('listIds', 'Có bảng xếp hạng không tồn tại');

    const jobs: { listId: string; listCode: string; jobId: string }[] = [];
    for (const list of lists) jobs.push({ listId: list.id, listCode: list.code, jobId: await this.enqueuer.enqueueSnapshot(list.id, asOfDate) });
    return { data: { asOfDate, jobs } };
  }
}
