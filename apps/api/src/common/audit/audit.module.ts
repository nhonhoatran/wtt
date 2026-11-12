import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { RequestContextMiddleware } from './request-context.js';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
