import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService, DATABASE_URL_TOKEN } from '../prisma/prisma.service.js';
import { AUTH_TOKEN, SessionGuard } from './auth.guard.js';
import { createAuth, DEFAULT_RATE_LIMIT } from './create-auth.js';

@Global()
@Module({
  providers: [
    { provide: DATABASE_URL_TOKEN, useFactory: () => process.env.DATABASE_URL ?? '' },
    PrismaService,
    {
      provide: AUTH_TOKEN,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        createAuth(
          prisma,
          {
            BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? '',
            BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? '',
          },
          {
            ...DEFAULT_RATE_LIMIT,
            signInMax: Number(process.env.SPIKE_SIGNIN_MAX ?? DEFAULT_RATE_LIMIT.signInMax),
          },
        ),
    },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [PrismaService, AUTH_TOKEN],
})
export class AuthModule {}
