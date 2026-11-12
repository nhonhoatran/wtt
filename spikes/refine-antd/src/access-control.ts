import type { AccessControlProvider } from '@refinedev/core';

export type Role = 'ADMIN' | 'RESULTS_OPERATOR';

export const getRole = (): Role => (localStorage.getItem('role') as Role) ?? 'ADMIN';

const ADMIN_ONLY = new Set(['users']);

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    if (resource && ADMIN_ONLY.has(resource) && getRole() !== 'ADMIN') {
      return { can: false, reason: 'Chi ADMIN' };
    }
    return { can: true };
  },
};
