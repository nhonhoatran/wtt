import { Module } from '@nestjs/common';
import { AdminSessionsController } from './admin-sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [AdminSessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
