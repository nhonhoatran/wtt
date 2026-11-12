import type { PermissionKey, UserRoleName } from '@kamito/shared';
import { ApiError, apiFetch } from '../api/http-client';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleName;
  permissions: PermissionKey[];
  mustChangePassword: boolean;
  listDefaultPageSize: number;
}

let pending: Promise<CurrentUser | null> | null = null;
const REASON_KEY = 'kamito.admin.signedOutReason';

/** Cached /auth/me; null when signed out. The API stays the authority on every request. */
export function loadCurrentUser(force = false): Promise<CurrentUser | null> {
  if (!pending || force) {
    pending = apiFetch<{ data: CurrentUser }>('/auth/me')
      .then((res) => res.data)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.statusCode === 401) {
          rememberSignedOutReason(error.code);
          return null;
        }
        pending = null;
        throw error;
      });
  }
  return pending;
}

export function forgetCurrentUser(): void {
  pending = null;
}

export function rememberSignedOutReason(code: string): void {
  try {
    sessionStorage.setItem(REASON_KEY, code);
  } catch {
    // Storage blocked: the login page simply shows no reason.
  }
}

/** Read once by the login page to explain why the user is there. */
export function takeSignedOutReason(): string | null {
  try {
    const code = sessionStorage.getItem(REASON_KEY);
    sessionStorage.removeItem(REASON_KEY);
    return code;
  } catch {
    return null;
  }
}
