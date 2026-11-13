import { Global, Module } from '@nestjs/common';
import { RevalidationEnqueueService } from './revalidation-enqueue.service.js';

@Global()
@Module({
  providers: [RevalidationEnqueueService],
  exports: [RevalidationEnqueueService],
})
export class RevalidationModule {}
