import type { AuthProvider } from '@refinedev/core';
import { ApiError, apiFetch } from '../api/http-client';
import { forgetCurrentUser, loadCurrentUser, rememberSignedOutReason } from './current-user';

interface LoginParams {
  email: string;
  password: string;
  to?: string;
}

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không đăng nhập được. Thử lại sau.';
  if (error.statusCode === 429) {
    const wait = error.retryAfterSeconds ? ` sau ${error.retryAfterSeconds} giây` : ' sau ít phút';
    return `Đăng nhập sai quá nhiều lần từ máy này. Thử lại${wait}.`;
  }
  if (error.statusCode === 401 || error.statusCode === 400) return 'Email hoặc mật khẩu không đúng.';
  return error.message;
}

/** Only same-app paths are followed after sign-in, never another site. */
function safeRedirect(to: string | undefined): string {
  // Browsers treat "/\host" like "//host", so backslashes are refused too.
  return to && to.startsWith('/') && !to.startsWith('//') && !to.includes('\\') ? to : '/';
}

export const authProvider: AuthProvider = {
  login: async ({ email, password, to }: LoginParams) => {
    try {
      await apiFetch('/auth/sign-in/email', { method: 'POST', body: { email, password } });
    } catch (error) {
      return { success: false, error: { name: 'Đăng nhập thất bại', message: loginErrorMessage(error) } };
    }
    const user = await loadCurrentUser(true);
    if (user?.mustChangePassword) return { success: true, redirectTo: '/change-password' };
    return { success: true, redirectTo: safeRedirect(to) };
  },
  logout: async () => {
    await apiFetch('/auth/sign-out', { method: 'POST', body: {} }).catch(() => undefined);
    forgetCurrentUser();
    return { success: true, redirectTo: '/login' };
  },
  check: async () => {
    const user = await loadCurrentUser().catch(() => null);
    return user ? { authenticated: true } : { authenticated: false, redirectTo: '/login', logout: true };
  },
  onError: async (error: unknown) => {
    if (!(error instanceof ApiError)) return {};
    if (error.statusCode === 401) {
      rememberSignedOutReason(error.code);
      forgetCurrentUser();
      return { logout: true, redirectTo: '/login' };
    }
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') return { redirectTo: '/change-password' };
    return {};
  },
  getIdentity: async () => loadCurrentUser().catch(() => null),
  getPermissions: async () => (await loadCurrentUser().catch(() => null))?.role ?? null,
};
