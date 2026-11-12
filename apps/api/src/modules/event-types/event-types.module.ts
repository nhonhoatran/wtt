import { Module } from '@nestjs/common';
import { AdminEventTypesController } from './admin-event-types.controller.js';
import { EventTypesService } from './event-types.service.js';

@Module({
  controllers: [AdminEventTypesController],
  providers: [EventTypesService],
})
export class EventTypesModule {}
