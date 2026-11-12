import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequireSession } from '../access-control/access-decorators.js';
import { requireAuthContext } from './auth-context.js';
import { AllowPendingPasswordChange } from './auth-decorators.js';
import { AuthService } from './auth.service.js';

/** Sign-in and sign-out are Better Auth's raw handler (see auth-raw-handler.ts). */
@Controller('auth')
@RequireSession()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @AllowPendingPasswordChange()
  async me(@Req() req: Request) {
    return { data: await this.authService.me(requireAuthContext(req)) };
  }

  @Post('change-password')
  @HttpCode(200)
  @AllowPendingPasswordChange()
  async changePassword(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.changePassword(requireAuthContext(req), body, req, res);
    return { data: { ok: true } };
  }

  @Post('step-up')
  @HttpCode(200)
  async stepUp(@Body() body: unknown, @Req() req: Request) {
    return { data: await this.authService.stepUp(requireAuthContext(req), body) };
  }
}
