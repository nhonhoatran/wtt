import { Controller, Get } from '@nestjs/common';

/** Process liveness only — no dependency calls, safe for container healthchecks. */
@Controller('health')
export class HealthLiveController {
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
