import { Module } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller.js';
import { EventsQueryService } from './events-query.service.js';
import { EventsService } from './events.service.js';

@Module({
  controllers: [AdminEventsController],
  providers: [EventsService, EventsQueryService],
})
export class EventsModule {}
