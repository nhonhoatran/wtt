import type { UserRoleName } from '@kamito/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleName;
  mustChangePassword: boolean;
}

export interface AuthSession {
  id: string;
  stepUpAt: Date | null;
}

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
}

const AUTH_KEY = Symbol('kamito.auth');

type RequestWithAuth = { [AUTH_KEY]?: AuthContext };

export function setAuthContext(req: object, auth: AuthContext): void {
  (req as RequestWithAuth)[AUTH_KEY] = auth;
}

export function getAuthContext(req: object): AuthContext | undefined {
  return (req as RequestWithAuth)[AUTH_KEY];
}

export function requireAuthContext(req: object): AuthContext {
  const auth = getAuthContext(req);
  if (!auth) throw new Error('Auth context missing: route is not behind SessionGuard');
  return auth;
}
