export const USER_ROLES = ['ADMIN', 'RESULTS_OPERATOR'] as const;

export type UserRoleName = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRoleName {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
