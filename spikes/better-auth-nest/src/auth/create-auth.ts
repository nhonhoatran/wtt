import { betterAuth } from 'better-auth';
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins/admin';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { AUTH_BASE_PATH, type AuthEnv } from './auth-env.js';
import { DISABLED_PATHS } from './disabled-paths.js';

export const ROLE_ADMIN = 'ADMIN';
export const ROLE_RESULTS_OPERATOR = 'RESULTS_OPERATOR';

const ac = createAccessControl(defaultStatements);
// ADMIN deliberately lacks impersonate/delete: permission layer denies them even if a path is re-enabled.
const roles = {
  [ROLE_ADMIN]: ac.newRole({
    user: ['create', 'list', 'set-role', 'ban', 'set-password', 'get', 'update'],
    session: ['list', 'revoke'],
  }),
  [ROLE_RESULTS_OPERATOR]: ac.newRole({ user: [], session: [] }),
};

const PASSWORD_GATE_ALLOWED = new Set(['/change-password', '/sign-out', '/get-session']);

export interface RateLimitOptions {
  window: number;
  max: number;
  signInWindow: number;
  signInMax: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { window: 60, max: 100, signInWindow: 10, signInMax: 3 };

// prisma is typed loosely: the adapter only needs the delegate surface, not the generated types.
export function createAuth(prisma: object, env: AuthEnv, rate: RateLimitOptions = DEFAULT_RATE_LIMIT) {
  return betterAuth({
    appName: 'kamito-spike',
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        mustChangePassword: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 15 },
    advanced: {
      // Explicit: Better Auth silently skips origin/CSRF checks when NODE_ENV=test unless this is set.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: rate.window,
      max: rate.max,
      customRules: { '/sign-in/email': { window: rate.signInWindow, max: rate.signInMax } },
    },
    disabledPaths: DISABLED_PATHS,
    plugins: [
      admin({
        ac,
        roles,
        adminRoles: [ROLE_ADMIN],
        defaultRole: ROLE_RESULTS_OPERATOR,
        bannedUserMessage: 'Account is disabled.',
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (PASSWORD_GATE_ALLOWED.has(ctx.path)) return;
        const session = await getSessionFromCtx(ctx).catch(() => null);
        const flagged = (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword;
        if (flagged) {
          throw ctx.error('FORBIDDEN', { message: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (isAPIError(ctx.context.returned)) return;
        const adapter = ctx.context.internalAdapter;
        if (ctx.path === '/admin/set-user-password') {
          const userId = (ctx.body as { userId: string }).userId;
          await adapter.updateUser(userId, { mustChangePassword: true });
          await adapter.deleteUserSessions(userId);
        } else if (ctx.path === '/admin/create-user') {
          const email = (ctx.body as { email: string }).email.toLowerCase();
          const user = await adapter.findUserByEmail(email);
          if (user) await adapter.updateUser(user.user.id, { mustChangePassword: true });
        } else if (ctx.path === '/change-password') {
          const userId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id;
          if (userId) await adapter.updateUser(userId, { mustChangePassword: false });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
