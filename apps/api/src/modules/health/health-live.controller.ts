import { Controller, Get } from '@nestjs/common';
import { Public } from '../access-control/access-decorators.js';

/** Process liveness only — no dependency calls, safe for container healthchecks. */
@Public()
@Controller('health')
export class HealthLiveController {
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
