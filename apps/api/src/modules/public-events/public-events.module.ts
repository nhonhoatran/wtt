import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicEventDetailQuery } from './public-event-detail.query.js';
import { PublicEventsController } from './public-events.controller.js';
import { PublicEventsListQuery } from './public-events-list.query.js';
import { PublicSiteQuery } from './public-site.query.js';

@Module({
  controllers: [PublicEventsController],
  providers: [PublicEventsListQuery, PublicEventDetailQuery, PublicSiteQuery, SsrInternalGuard],
})
export class PublicEventsModule {}
