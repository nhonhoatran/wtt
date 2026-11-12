import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { TrustedOriginMiddleware } from '../../common/security/trusted-origin.js';
import { PermissionGuard } from '../access-control/permission.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountLockoutService } from './account-lockout.service.js';
import { MustChangePasswordGuard, SessionGuard, StepUpGuard } from './auth-guards.js';
import { AUTH_INSTANCE, createAuth } from './auth-instance.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginIpRateLimiter } from './login-ip-rate-limiter.service.js';
import { SessionResolver } from './session-resolver.service.js';
import { SignInPolicyService } from './sign-in-policy.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AccountLockoutService,
    LoginIpRateLimiter,
    SignInPolicyService,
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, API_ENV, SignInPolicyService],
      useFactory: (prisma: PrismaService, env: ApiEnv, policy: SignInPolicyService) => createAuth(prisma, env, policy),
    },
    SessionResolver,
    AuthService,
    // Order matters: session -> must-change-password -> permission (deny-by-default) -> step-up.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: StepUpGuard },
  ],
  exports: [AUTH_INSTANCE, SessionResolver, AccountLockoutService, LoginIpRateLimiter],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TrustedOriginMiddleware).forRoutes('admin/*path', 'auth/*path');
  }
}
