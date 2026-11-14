import { Global, Module } from '@nestjs/common';
import { AdminRevalidationController } from './admin-revalidation.controller.js';
import { RevalidationEnqueueService } from './revalidation-enqueue.service.js';

@Global()
@Module({
  controllers: [AdminRevalidationController],
  providers: [RevalidationEnqueueService],
  exports: [RevalidationEnqueueService],
})
export class RevalidationModule {}
