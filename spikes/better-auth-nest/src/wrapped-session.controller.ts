import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { AllowPendingPasswordChange, Public } from './auth/auth-decorators.js';
import { AUTH_TOKEN } from './auth/auth.guard.js';
import type { Auth } from './auth/create-auth.js';

async function relay(res: Response, up: globalThis.Response): Promise<void> {
  for (const cookie of up.headers.getSetCookie()) res.append('set-cookie', cookie);
  res.status(up.status);
  const text = await up.text();
  res.type('application/json').send(text || 'null');
}

/** Explicit controllers that call auth.api server-side instead of exposing the raw handler. */
@Controller('session')
export class WrappedSessionController {
  constructor(@Inject(AUTH_TOKEN) private readonly auth: Auth) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res() res: Response) {
    const upstream = await this.auth.api.signInEmail({
      body: { email: String(body?.email ?? ''), password: String(body?.password ?? '') },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });
    await relay(res, upstream);
  }

  @Post('logout')
  @AllowPendingPasswordChange()
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response) {
    const upstream = await this.auth.api.signOut({ headers: fromNodeHeaders(req.headers), asResponse: true });
    await relay(res, upstream);
  }

  @Post('change-password')
  @AllowPendingPasswordChange()
  @HttpCode(200)
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const upstream = await this.auth.api.changePassword({
      body: {
        currentPassword: String(body?.currentPassword ?? ''),
        newPassword: String(body?.newPassword ?? ''),
        revokeOtherSessions: true,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });
    await relay(res, upstream);
  }
}
