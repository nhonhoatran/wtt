/** Reachable without a session (still subject to rate limit and credential checks). */
export const UNAUTH_PATHS = ['/sign-in/email', '/sign-out', '/get-session'];

/** Reachable only with a valid session (Better Auth enforces it, admin plugin enforces ADMIN). */
export const AUTHED_PATHS = [
  '/change-password',
  '/admin/create-user',
  '/admin/list-users',
  '/admin/get-user',
  '/admin/set-role',
  '/admin/set-user-password',
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/list-user-sessions',
  '/admin/revoke-user-session',
  '/admin/revoke-user-sessions',
  '/admin/update-user',
];

export const RAW_ALLOWLIST = [...UNAUTH_PATHS, ...AUTHED_PATHS];
