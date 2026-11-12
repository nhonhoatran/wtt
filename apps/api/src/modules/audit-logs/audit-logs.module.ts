import { Module } from '@nestjs/common';
import { AdminAuditLogsController } from './admin-audit-logs.controller.js';

@Module({ controllers: [AdminAuditLogsController] })
export class AuditLogsModule {}
