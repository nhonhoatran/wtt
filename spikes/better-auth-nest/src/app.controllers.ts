import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public, Roles } from './auth/auth-decorators.js';
import type { AuthedUser } from './auth/auth.guard.js';

type AuthedRequest = Request & { user: AuthedUser };

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Roles('ADMIN')
  @Get('admin/ping')
  adminPing() {
    return { ok: 'admin' };
  }

  @Roles('ADMIN', 'RESULTS_OPERATOR')
  @Get('operator/ping')
  operatorPing() {
    return { ok: 'operator' };
  }
}
