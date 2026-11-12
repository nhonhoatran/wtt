import type { UserRoleName } from './user-role.js';

export const PERMISSION_ACTIONS = [
  'list',
  'read',
  'create',
  'update',
  'delete',
  'confirm',
  'amend',
  'reopen',
  'publish',
  'manage',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Resources follow the admin menu groups; later phases add resources here, not new roles. */
export const PERMISSION_RESOURCES = [
  'tournaments',
  'matches',
  'players',
  'rankings',
  'content',
  'sponsors',
  'media',
  'settings',
  'users',
  'audit-logs',
  'queues',
] as const;
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

type Grant = readonly PermissionAction[] | 'all';

const READ_ONLY: Grant = ['list', 'read'];

/** Single source of truth: the API guard enforces it, the admin UI only hides what it denies. */
export const PERMISSION_MATRIX: Record<UserRoleName, Partial<Record<PermissionResource, Grant>>> = {
  ADMIN: Object.fromEntries(PERMISSION_RESOURCES.map((resource) => [resource, 'all'])),
  RESULTS_OPERATOR: {
    tournaments: READ_ONLY,
    players: READ_ONLY,
    // reopen / force-reopen stay ADMIN-only.
    matches: ['list', 'read', 'update', 'confirm', 'amend'],
  },
};

export function can(role: UserRoleName, resource: PermissionResource, action: PermissionAction): boolean {
  const grant = PERMISSION_MATRIX[role]?.[resource];
  if (!grant) return false;
  return grant === 'all' || grant.includes(action);
}

export type PermissionKey = `${PermissionResource}.${PermissionAction}`;

/** Flattened "resource.action" list sent to the admin UI by /auth/me. */
export function permissionsFor(role: UserRoleName): PermissionKey[] {
  return PERMISSION_RESOURCES.flatMap((resource) =>
    PERMISSION_ACTIONS.filter((action) => can(role, resource, action)).map(
      (action) => `${resource}.${action}` as PermissionKey,
    ),
  );
}
