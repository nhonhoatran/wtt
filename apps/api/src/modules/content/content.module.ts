import { Module } from '@nestjs/common';
import { AdminContentController } from './admin-content.controller.js';
import { PublishingEnqueueService } from './publishing-enqueue.service.js';
import { ContentErrorsInterceptor } from './content-errors.interceptor.js';
import { ContentWritesService } from './content-writes.service.js';
import { SponsorOrderService } from './sponsor-order.service.js';

@Module({ controllers: [AdminContentController], providers: [PublishingEnqueueService, ContentErrorsInterceptor, ContentWritesService, SponsorOrderService] })
export class ContentModule {}
