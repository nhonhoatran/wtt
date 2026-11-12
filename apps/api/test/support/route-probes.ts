import type { Express } from 'express';
import { AUTH_BASE_PATH, type Auth } from '../../src/modules/auth/auth-instance.js';

export interface Probe {
  method: string;
  path: string;
}

// Enough fields that body validation does not hide a missing auth check.
export const PROBE_BODY = {
  email: 'probe@test.kamito.local',
  password: 'probe-password-123',
  newPassword: 'probe-password-456',
  currentPassword: 'probe-password-123',
  name: 'Probe',
  userId: 'probe',
  role: 'ADMIN',
  value: 1,
  token: 'probe',
};

export function concretePath(path: string): string {
  return path.replace(/:[A-Za-z_]+/g, 'probe').replace(/\*[A-Za-z_]+/g, 'probe');
}

export function expressRoutes(server: Express): Probe[] {
  const stack = (server.router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack.flatMap((layer) =>
    layer.route ? Object.keys(layer.route.methods).map((method) => ({ method: method.toUpperCase(), path: layer.route!.path })) : [],
  );
}

export function betterAuthRoutes(auth: Auth): Probe[] {
  return Object.values(auth.api).flatMap((endpoint) => {
    const { path, options } = endpoint as unknown as { path?: string; options?: { method?: string | string[] } };
    if (!path) return [];
    const methods = ([] as string[]).concat(options?.method ?? 'GET');
    return methods.map((method) => ({ method: method === '*' ? 'POST' : method, path: `${AUTH_BASE_PATH}${path}` }));
  });
}
