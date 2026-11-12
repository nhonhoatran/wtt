import { describe, expect, it } from 'vitest';
import { can, PERMISSION_ACTIONS, PERMISSION_RESOURCES, permissionsFor } from './permissions.js';

describe('permission matrix', () => {
  it('grants ADMIN every action on every resource', () => {
    for (const resource of PERMISSION_RESOURCES) {
      for (const action of PERMISSION_ACTIONS) expect(can('ADMIN', resource, action)).toBe(true);
    }
  });

  it('lets RESULTS_OPERATOR enter, confirm and amend scores but not reopen', () => {
    for (const action of ['list', 'read', 'update', 'confirm', 'amend'] as const) {
      expect(can('RESULTS_OPERATOR', 'matches', action)).toBe(true);
    }
    expect(can('RESULTS_OPERATOR', 'matches', 'reopen')).toBe(false);
    expect(can('RESULTS_OPERATOR', 'matches', 'delete')).toBe(false);
  });

  it('gives RESULTS_OPERATOR read-only tournaments and players', () => {
    for (const resource of ['tournaments', 'players'] as const) {
      expect(can('RESULTS_OPERATOR', resource, 'list')).toBe(true);
      expect(can('RESULTS_OPERATOR', resource, 'read')).toBe(true);
      expect(can('RESULTS_OPERATOR', resource, 'create')).toBe(false);
      expect(can('RESULTS_OPERATOR', resource, 'update')).toBe(false);
    }
  });

  it('denies RESULTS_OPERATOR the ADMIN-only groups', () => {
    for (const resource of ['rankings', 'content', 'sponsors', 'settings', 'users', 'audit-logs', 'queues'] as const) {
      for (const action of PERMISSION_ACTIONS) expect(can('RESULTS_OPERATOR', resource, action)).toBe(false);
    }
  });

  it('flattens permissions as resource.action keys', () => {
    const operator = permissionsFor('RESULTS_OPERATOR');
    expect(operator).toContain('matches.confirm');
    expect(operator).not.toContain('users.list');
    expect(permissionsFor('ADMIN')).toHaveLength(PERMISSION_RESOURCES.length * PERMISSION_ACTIONS.length);
  });

  it('denies unknown roles', () => {
    expect(can('GUEST' as never, 'matches', 'read')).toBe(false);
  });
});
