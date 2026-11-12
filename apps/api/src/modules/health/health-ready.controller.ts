import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type CheckResult, ReadinessChecksService } from './readiness-checks.service.js';

export interface ReadinessReport {
  status: 'ready' | 'degraded' | 'not_ready';
  checks: Record<string, CheckResult>;
}

export function summarize(checks: Record<string, CheckResult>): ReadinessReport['status'] {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.includes('down')) return 'not_ready';
  return statuses.includes('degraded') ? 'degraded' : 'ready';
}

/** Internal network only: the admin proxy and public client never forward /health/*. */
@Controller('health')
export class HealthReadyController {
  constructor(private readonly checks: ReadinessChecksService) {}

  @Get('ready')
  @HttpCode(200)
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const checks = await this.checks.runAll();
    const status = summarize(checks);
    if (status === 'not_ready') res.status(503);
    return { status, checks };
  }
}
