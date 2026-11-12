import { authSettings } from '@kamito/shared';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { normalizeEmail } from './auth-redis-keys.js';

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');
export const AUTH_BASE_PATH = '/api/v1/auth';
export const SIGN_IN_PATH = '/sign-in/email';

/** Same body Better Auth returns for a wrong password, so locked/disabled accounts are indistinguishable. */
export const INVALID_CREDENTIALS = { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' };

export interface SignInPolicy {
  /** false rejects the attempt with INVALID_CREDENTIALS before the password is checked. */
  allowAttempt(email: string): Promise<boolean>;
  onFailure(email: string): Promise<void>;
  onSuccess(userId: string, email: string): Promise<void>;
}

// Better Auth reads these at start-up; the per-request values from /settings are enforced by SessionResolver.
const SESSION_CEILING_SECONDS = authSettings.sessionMaxAgeHours.editor!.max * 60 * 60;
const PASSWORD_MIN_FLOOR = authSettings.passwordMinLength.editor!.min;

let dummyHash: Promise<string> | undefined;

/** Spends the same scrypt time as a real check, so a rejected account does not answer faster. */
async function burnPasswordCheck(password: unknown): Promise<void> {
  dummyHash ??= hashPassword('timing-equalizer');
  await verifyPassword({ hash: await dummyHash, password: typeof password === 'string' ? password : '' });
}

// The adapter only needs the Prisma delegate surface, not the generated types.
export function createAuth(prisma: object, env: ApiEnv, policy: SignInPolicy) {
  const adminOrigin = new URL(env.ADMIN_PUBLIC_URL).origin;
  return betterAuth({
    appName: 'kamito-tt',
    baseURL: adminOrigin,
    basePath: AUTH_BASE_PATH,
    secret: env.AUTH_SECRET,
    trustedOrigins: [adminOrigin],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_FLOOR,
      maxPasswordLength: 128,
    },
    session: { expiresIn: SESSION_CEILING_SECONDS, disableSessionRefresh: true },
    // Login throttling lives in Redis (LoginIpRateLimiter, AccountLockoutService) so /settings can tune it.
    rateLimit: { enabled: false },
    advanced: {
      // Explicit: Better Auth silently skips origin/CSRF checks when NODE_ENV=test unless these are set.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
      // The raw handler overwrites X-Forwarded-For with req.ip before Better Auth reads it.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const body = ctx.body as { email?: unknown; password?: unknown } | undefined;
        const email = normalizeEmail(body?.email);
        if (email && !(await policy.allowAttempt(email))) {
          await burnPasswordCheck(body?.password);
          throw new APIError('UNAUTHORIZED', INVALID_CREDENTIALS);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = normalizeEmail((ctx.body as { email?: unknown } | undefined)?.email);
        const returned = ctx.context.returned;
        if (isAPIError(returned)) {
          if (returned.statusCode === 401 && email) await policy.onFailure(email);
          return;
        }
        const userId = ctx.context.newSession?.user.id;
        if (userId) await policy.onSuccess(userId, email);
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
