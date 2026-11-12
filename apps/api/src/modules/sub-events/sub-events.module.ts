import { Module } from '@nestjs/common';
import { AdminSubEventsController } from './admin-sub-events.controller.js';
import { SubEventsService } from './sub-events.service.js';

@Module({
  controllers: [AdminSubEventsController],
  providers: [SubEventsService],
})
export class SubEventsModule {}
